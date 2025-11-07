from ultralytics import YOLO
import supervision as sv
import cv2
import numpy as np
import time
import threading
import queue
from collections import deque
from modules.database import save_counts_to_mongo

# ============================================================
# --- Global Configuration & Constants ---
# ============================================================

STANDARD_SIZE = (640, 480)         # Target frame resolution for all streams
ROLLING_WINDOW = 60                # Time window (in seconds) for rolling counts
MODEL_PATH = "Models/best.pt"      # Path to YOLO model weights

# Map of video source identifiers to file paths
VIDEO_MAP = {
    "location1": "video_source/test.mp4",
    "location2": "video_source/test1.mp4",
    "location3": "video_source/test2.mp4"
}

# Batch inference configuration
BATCH_SIZE = len(VIDEO_MAP)
# Frame queue for communication between video readers and inference worker
# A small maxsize prevents excessive memory use if inference becomes a bottleneck
frame_queue = queue.Queue(maxsize=BATCH_SIZE * 2)
# Each video stream has its own post-processing results queue
results_queues = {loc: queue.Queue(maxsize=2) for loc in VIDEO_MAP}

# Desired effective processing frame rate
TARGET_PROCESSING_FPS = 4

# Shared state for 1-minute rolling counts across locations
last_1min_counts_per_location = {}
counts_lock = threading.Lock()  # Lock to ensure thread-safe writes to shared state


# ============================================================
# --- StreamPostProcessor Class ---
# ============================================================

class StreamPostProcessor:
    """
    Handles post-processing for each video stream, including:
      - Object tracking using ByteTrack
      - Line crossing detection for counting
      - Rolling aggregation of counts over 1 minute
      - Frame annotation (boxes, lines, labels)
      - JPEG encoding for live stream display
      - Periodic saving of aggregated counts to MongoDB
    """

    def __init__(self, location, class_name_dict, results_queue):
        """
        Initialize post-processor for a specific video stream.

        Args:
            location (str): Unique identifier for the video source.
            class_name_dict (dict): Mapping of class IDs to class names.
            results_queue (queue.Queue): Queue receiving YOLO inference results.
        """
        self.location = location
        self.class_name_dict = class_name_dict
        self.results_queue = results_queue

        # State variables
        self.latest_frame = None       # Last processed frame (JPEG-encoded)
        self.running = True            # Control flag for thread loop
        self.last_save_time = time.time()  # Last DB save timestamp

        # Rolling window for storing historical counts
        self.rolling_counts = deque()

        # Supervision (sv) utilities for tracking, annotation, and line detection
        self.byte_tracker = sv.ByteTrack(frame_rate=30)
        self.box_annotator = sv.BoxAnnotator(thickness=1)
        self.line_zone_annotator = sv.LineZoneAnnotator(thickness=2, text_thickness=0, text_scale=0)

        # Define a horizontal counting line (default near bottom of frame)
        line_y = int(STANDARD_SIZE[1] * 0.7)
        self.line_counter = sv.LineZone(
            start=sv.Point(0, line_y),
            end=sv.Point(STANDARD_SIZE[0], line_y)
        )

        # Create background thread for post-processing loop
        self.thread = threading.Thread(target=self._run, daemon=True)

    def start(self):
        """Start the post-processing thread."""
        self.thread.start()

    def stop(self):
        """Safely stop the post-processing thread."""
        self.running = False
        self.results_queue.put(None)  # Unblock the queue if waiting
        if self.thread.is_alive():
            self.thread.join(timeout=1)

    def get_latest_frame(self):
        """Return the latest processed frame (for display or streaming)."""
        return self.latest_frame

    def _run(self):
        """Main loop for processing detection results from YOLO."""
        while self.running:
            item = self.results_queue.get()

            # Graceful shutdown signal
            if item is None or not self.running:
                break

            frame, results = item

            # Convert YOLO results to Supervision format and apply tracker
            detections = sv.Detections.from_ultralytics(results)
            detections = self.byte_tracker.update_with_detections(detections)

            # --- Line crossing count logic ---
            frame_counts = {cls: 0 for cls in self.class_name_dict.values()}
            _, crossed_out = self.line_counter.trigger(detections)

            # Increment counts for each class that crosses the line
            for idx in np.where(crossed_out)[0]:
                class_id = int(detections.class_id[idx])
                class_name = self.class_name_dict[class_id]
                frame_counts[class_name] += 1
            frame_counts["Total"] = sum(frame_counts.values())

            # --- Frame Annotation ---
            labels = [f"{self.class_name_dict[int(cls_id)]}" for cls_id in detections.class_id]
            annotated_frame = self.box_annotator.annotate(scene=frame.copy(), detections=detections)

            # Manually draw class names above bounding boxes
            for xyxy, cls_id in zip(detections.xyxy, detections.class_id):
                x1, y1, x2, y2 = map(int, xyxy)
                class_name = self.class_name_dict[int(cls_id)]
                cv2.putText(
                    annotated_frame,
                    class_name,
                    (x1, max(20, y1 - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 255, 0),
                    1,
                    cv2.LINE_AA
                )

            # Draw the counting line with label
            line_y = int(STANDARD_SIZE[1] * 0.7)
            cv2.line(annotated_frame, (0, line_y), (STANDARD_SIZE[0], line_y), (0, 255, 0), thickness=2, lineType=cv2.LINE_AA)
            cv2.putText(
                annotated_frame,
                "Counting Line",
                (10, line_y - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2,
                cv2.LINE_AA
            )

            # --- Rolling window aggregation (for past 1 minute) ---
            now = time.time()
            self.rolling_counts.append((now, frame_counts))

            # Remove old entries beyond the 60s window
            while self.rolling_counts and now - self.rolling_counts[0][0] > ROLLING_WINDOW:
                self.rolling_counts.popleft()

            # Compute aggregate counts within current window
            sum_counts = {cls: 0 for cls in self.class_name_dict.values()}
            for _, counts in self.rolling_counts:
                for cls in self.class_name_dict.values():
                    sum_counts[cls] += counts.get(cls, 0)
            sum_counts["Total"] = sum(sum_counts.values())

            # Update shared global dictionary safely
            with counts_lock:
                last_1min_counts_per_location[self.location] = sum_counts

            # Periodically save results to MongoDB (every 60s)
            if now - self.last_save_time >= 60:
                threading.Thread(
                    target=save_counts_to_mongo,
                    args=(sum_counts, self.location),
                    daemon=True
                ).start()
                self.last_save_time = now

            # Encode annotated frame for streaming (JPEG format)
            success, buffer = cv2.imencode('.jpg', annotated_frame)
            if success:
                self.latest_frame = (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n'
                )


# ============================================================
# --- Worker Thread Functions ---
# ============================================================

def video_reader_worker(location, video_path, frame_queue):
    """
    Continuously read frames from a given video source and push to frame_queue.

    Args:
        location (str): Location identifier.
        video_path (str): Path to the video file.
        frame_queue (queue.Queue): Shared queue for transferring frames.
    """
    print(f"[{location}] Reader thread started...")
    cap = cv2.VideoCapture(video_path)

    # Get FPS for pacing frame reads
    video_fps = cap.get(cv2.CAP_PROP_FPS)
    frame_delay = 1.0 / video_fps
    skip_rate = max(1, round(video_fps / TARGET_PROCESSING_FPS))

    frame_counter = 0

    if not cap.isOpened():
        print(f"[{location}] Could not open video: {video_path}")
        return

    while True:
        try:
            success, frame = cap.read()
            if not success:
                print(f"[{location}] End of video, re-opening...")
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                frame_counter = 0
                continue

            frame_counter += 1

            # Skip frames to match target FPS
            if frame_counter == skip_rate or skip_rate <= 1:
                frame_counter = 0  # Reset the counter
                frame_resized = cv2.resize(frame, STANDARD_SIZE)
                frame_queue.put((location, frame_resized))

            # Sleep to prevent CPU overuse
            time.sleep(frame_delay)

        except Exception as e:
            print(f"[{location}] Reader error: {e}")
            time.sleep(1)


def inference_worker(model, frame_queue, results_queues, batch_size):
    """
    Perform batched YOLO inference and distribute results to each location's queue.

    Args:
        model (YOLO): Preloaded YOLO model instance.
        frame_queue (queue.Queue): Shared queue receiving frames from all readers.
        results_queues (dict): Map of location to its dedicated result queue.
        batch_size (int): Number of frames to process per batch.
    """
    print("Inference worker started...")
    while True:
        batch_frames = []
        batch_locations = []

        # Try to get the first frame (blocking)
        try:
            location, frame = frame_queue.get(timeout=1)
            batch_frames.append(frame)
            batch_locations.append(location)
        except queue.Empty:
            continue  # No frames ready yet

        # Fill the rest of the batch if available
        while len(batch_frames) < batch_size:
            try:
                loc, frm = frame_queue.get_nowait()
                batch_frames.append(frm)
                batch_locations.append(loc)
            except queue.Empty:
                break  # No more frames, run partial batch

        # Run YOLO inference
        if batch_frames:
            try:
                results_list = model(batch_frames, verbose=False, imgsz=224)

                # Send each result to its corresponding post-processor
                for i, results in enumerate(results_list):
                    loc = batch_locations[i]
                    frm = batch_frames[i]
                    results_queues[loc].put((frm.copy(), results.cpu()))

            except Exception as e:
                print(f"[Inference] Error processing batch: {e}")


# ============================================================
# --- Main Application Setup ---
# ============================================================

print("Loading global YOLO model...")
model = YOLO(MODEL_PATH)
# model.to('cuda')  # Uncomment to enable GPU inference if available
CLASS_NAME_DICT = model.model.names
print(f"Model loaded. Classes: {CLASS_NAME_DICT}")

# Start a single inference worker thread
threading.Thread(
    target=inference_worker,
    args=(model, frame_queue, results_queues, BATCH_SIZE),
    daemon=True
).start()

# Start a post-processing thread for each video stream
post_processors = {}
for loc in VIDEO_MAP.keys():
    pp = StreamPostProcessor(loc, CLASS_NAME_DICT, results_queues[loc])
    pp.start()
    post_processors[loc] = pp
    print(f"Started post-processor for: {loc}")

# Start a video reader thread for each video stream
for loc, path in VIDEO_MAP.items():
    threading.Thread(
        target=video_reader_worker,
        args=(loc, path, frame_queue),
        daemon=True
    ).start()
    print(f"Started video reader for: {loc}")
