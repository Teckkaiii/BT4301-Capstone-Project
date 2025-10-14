from ultralytics import YOLO
import supervision as sv
import numpy as np
import cv2
import time
from flask import Flask, render_template, Response
import os
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime, timedelta
from collections import deque
import time

# Store counts with timestamps for 1-minute rolling window
rolling_counts = deque()  # each element: (timestamp, frame_counts)
ROLLING_WINDOW = 60  # seconds



# ======================================
# 1. Flask and MongoDB Initialization
# ======================================

app = Flask(__name__)

# Load environment variables (works locally & in Docker)
load_dotenv(dotenv_path=".env")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/vehicle_db")
client = MongoClient(MONGO_URI)
db = client["vehicle_db"]
counts_collection = db["vehicle_counts"]

def save_counts_to_mongo(counts_dict):
    """Save vehicle counts to MongoDB with a timestamp."""
    payload = {
        "timestamp": datetime.utcnow(),
        "counts": counts_dict
    }
    counts_collection.insert_one(payload)
    print(f"[{datetime.utcnow()}] Counts saved to MongoDB:", counts_dict)

    from pymongo import MongoClient



# ======================================
# 2. YOLO + Supervision Setup
# ======================================

model_path = os.path.join(os.getcwd(), "Models", "best (test model).pt")
model = YOLO(model_path)
byte_tracker = sv.ByteTrack(frame_rate=30)

# Line config
LINE_START = sv.Point(0, 400)
LINE_END = sv.Point(800, 400)

# Create line counter, annotators, and vehicle counts
line_counter = sv.LineZone(start=LINE_START, end=LINE_END)
line_zone_annotator = sv.LineZoneAnnotator(thickness=1, text_thickness=1, text_scale=1)
box_annotator = sv.BoxAnnotator(thickness=1)
trace_annotator = sv.TraceAnnotator(thickness=2, trace_length=60)

CLASS_NAME_DICT = model.model.names
vehicle_counts = {name: 0 for name in CLASS_NAME_DICT.values()}

# ======================================
# 3. Frame Processing Function
# ======================================

def process_frame(frame):
    results = model(frame, verbose=False)[0]
    detections = sv.Detections.from_ultralytics(results)
    detections = byte_tracker.update_with_detections(detections)

    # Initialize per-frame counts (used for 1-min sum only)
    frame_counts = {cls: 0 for cls in CLASS_NAME_DICT.values()}

    # Detect line crossings
    crossed_in, crossed_out = line_counter.trigger(detections)
    out_indices = np.where(crossed_out)[0]

    for det_idx in out_indices:
        class_id = int(detections.class_id[det_idx])
        class_name = CLASS_NAME_DICT[class_id]
        frame_counts[class_name] += 1

    # Add total count
    frame_counts["Total"] = sum(frame_counts.values())

    # Annotate frame (no counts displayed)
    annotated_frame = trace_annotator.annotate(scene=frame.copy(), detections=detections)
    annotated_frame = box_annotator.annotate(scene=annotated_frame, detections=detections)
    annotated_frame = line_zone_annotator.annotate(annotated_frame, line_counter=line_counter)

    # Return only the annotated frame and frame_counts (for rolling sum)
    return annotated_frame, frame_counts



# ======================================
# 4. Frame Generator with 1-Minute DB Save
# ======================================

from collections import deque
import time
import cv2

# Rolling window in seconds (1 minute)
ROLLING_WINDOW = 60
rolling_counts = deque()  # stores tuples of (timestamp, frame_counts)

def generate_frames():
    video_path = os.path.join(os.getcwd(), "test.mp4")
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print(f"Error: Could not open video file at {video_path}")
        return

    global last_1min_counts

    while True:
        success, frame = cap.read()
        if not success:
            print("Video ended, restarting...")
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        processed_frame, frame_counts = process_frame(frame)

        # Add current frame counts with timestamp
        now = time.time()
        rolling_counts.append((now, frame_counts))

        # Remove counts older than 60 seconds
        while rolling_counts and now - rolling_counts[0][0] > ROLLING_WINDOW:
            rolling_counts.popleft()

        # Sum counts for the last 1 minute
        sum_counts = {cls: 0 for cls in CLASS_NAME_DICT.values()}
        for _, counts in rolling_counts:
            for cls in CLASS_NAME_DICT.values():
                sum_counts[cls] += counts[cls]
        sum_counts["Total"] = sum(sum_counts.values())

        last_1min_counts = sum_counts  # global variable for /current_counts endpoint

        # Optional: save to MongoDB every 60 seconds
        if rolling_counts and now - rolling_counts[0][0] >= ROLLING_WINDOW:
            save_counts_to_mongo(sum_counts)

        # Draw counts on frame
        y_offset = 30
        for cls, count in sum_counts.items():
            cv2.putText(
                processed_frame,
                f"{cls}: {count}",
                (10, y_offset),
                fontFace=cv2.FONT_HERSHEY_SIMPLEX,
                fontScale=0.6,
                color=(0, 0, 255),
                thickness=2
            )
            y_offset += 25

        ret, buffer = cv2.imencode('.jpg', processed_frame)
        if not ret:
            continue
            
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

        time.sleep(0.03)



# ======================================
# 5. Congestion Level Calculation Function
# ======================================
def get_congestion_level(interval_minutes=5):
    """Calculate congestion level based on average vehicles over the last `interval_minutes`."""
    from datetime import datetime, timedelta  # make sure these are imported
    
    now = datetime.utcnow()
    past_time = now - timedelta(minutes=interval_minutes)
    
    recent_counts = list(counts_collection.find({"timestamp": {"$gte": past_time}}))
    
    if not recent_counts:  # handle empty DB
        return {"level": "Low", "average_vehicles": 0}
    
    total_vehicles = 0
    for doc in recent_counts:
        total_vehicles += sum(doc["counts"].values())
    
    avg_vehicles = total_vehicles / len(recent_counts)  # average per entry
    
    # Define congestion levels based on average vehicles
    if avg_vehicles > 50:
        level = "High"
    elif avg_vehicles > 20:
        level = "Medium"
    else:
        level = "Low"
    
    return {"level": level, "average_vehicles": avg_vehicles}


# ======================================
# 6. Flask Routes
# ======================================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/current_counts')
def current_counts():
    global last_1min_counts
    return last_1min_counts

@app.route('/congestion')
def congestion():
    data = get_congestion_level(interval_minutes=5)
    return data


# ======================================
# 7. Run App
# ======================================

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
