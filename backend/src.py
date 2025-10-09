from ultralytics import YOLO
import supervision as sv
import numpy as np
import cv2
import time
from flask import Flask, render_template, Response

# Initialize the Flask app
app = Flask(__name__)

# --- Placeholder for Your Model and Tracker ---
# In a real application, you would initialize your YOLO model and ByteTrack tracker here.
# For example:
model = YOLO(r"BT4301-Capstone-Project\backend\Models\best (test model).pt")
byte_tracker = sv.ByteTrack(frame_rate = 30)

# Line config 
LINE_START = sv.Point(0, 400)
LINE_END = sv.Point(800, 400)

# create bytetracker instance
byte_tracker = sv.ByteTrack(frame_rate = 30)

# create line conuter instance
line_counter = sv.LineZone(start = LINE_START, end = LINE_END)

# create line zone annotator
line_zone_annotator = sv.LineZoneAnnotator(thickness=1, text_thickness=1, text_scale=1)

# create box annotator
box_annotator = sv.BoxAnnotator(thickness=1)

# create trace annotator
trace_annotator = sv.TraceAnnotator(thickness=2, trace_length=60)

# Create dictionary to store counts for each vehicle type
CLASS_NAME_DICT = model.model.names
vehicle_counts = {name: 0 for name in CLASS_NAME_DICT.values()}

def process_frame(frame):
    # get results from model
    results = model(frame, verbose=False)[0]

    # convert to detections
    detections = sv.Detections.from_ultralytics(results)

    # tracking detection
    detections = byte_tracker.update_with_detections(detections)

    # create labels
    labels = []
    for confidence, class_id, tracker_id in zip(detections.confidence, detections.class_id, detections.tracker_id):
        label = f'{tracker_id} {CLASS_NAME_DICT[class_id]} {confidence:0.2f}'
        labels.append(label)

    # update trace annotator
    annotated_frame = trace_annotator.annotate(scene=frame.copy(), detections=detections)

    # update box annotator
    annotated_frame = box_annotator.annotate(scene=annotated_frame, detections=detections)

    # overlay labels in the boundingbox
    for box, label in zip(detections.xyxy, labels):
        x1, y1, x2, y2 = box.astype(int)

        # display label above the box
        cv2.putText(
            annotated_frame, label, (x1, y1-10),
            fontFace = cv2.FONT_HERSHEY_COMPLEX, fontScale = 0.4,
            color=(0, 255, 0), thickness = 1
        )

    # detect line crossings
    crossed_in, crossed_out = line_counter.trigger(detections)

    # get the indices where True
    # in_indices = np.where(crossed_in)[0]
    out_indices = np.where(crossed_out)[0]

    # for det_idx in np.concatenate([in_indices, out_indices]):
    for det_idx in out_indices:
        class_id = int(detections.class_id[det_idx])
        class_name = CLASS_NAME_DICT[class_id]
        vehicle_counts[class_name] += 1

    # update line zone annotator
    annotated_frame = line_zone_annotator.annotate(annotated_frame, line_counter=line_counter)

    # also display vehicle counts on the frame
    y_offset = 30
    for cls, count in vehicle_counts.items():
        cv2.putText(
            annotated_frame, f"{cls}: {count}", (10, y_offset),
            fontFace=cv2.FONT_HERSHEY_SIMPLEX, fontScale=0.6,
            color=(0, 0, 255), thickness=2
        )
        y_offset += 25

    return annotated_frame

def generate_frames():
    """
    Reads video from a local file, processes each frame using the AI model,
    and yields it as a byte stream for the web page.
    """
    video_path = 'Test Data\whatsapp video.mp4'
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print(f"Error: Could not open video file at {video_path}")
        return

    while True:
        success, frame = cap.read()
        if not success:
            # If the video ends, reset to the beginning to loop it
            print("Video ended, restarting...")
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        
        # Process the frame with your model
        processed_frame = process_frame(frame)

        # Encode the frame in JPEG format
        ret, buffer = cv2.imencode('.jpg', processed_frame)
        if not ret:
            print("Error: Failed to encode frame.")
            continue
            
        frame_bytes = buffer.tobytes()

        # Yield the frame in the multipart format
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        # Control streaming speed (optional, can help reduce CPU load)
        time.sleep(0.03) # Corresponds to ~33 FPS

@app.route('/')
def index():
    """Route to serve the main HTML page."""
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    """Route that streams the video frames."""
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    # Running the app
    # Use host='0.0.0.0' to make it accessible from other devices on your network
    app.run(debug=True, host='0.0.0.0', port=5000)