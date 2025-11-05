from ultralytics import YOLO
import supervision as sv
import cv2
import numpy as np
import time
import threading
import queue
from collections import deque
from modules.database import save_counts_to_mongo

# --- Constants ---
STANDARD_SIZE = (640, 480)
ROLLING_WINDOW = 60
MODEL_PATH = "Models/best.pt"

VIDEO_MAP = {
    "location1": "video_source/test.mp4",
    "location2": "video_source/test1.mp4",
    "location3": "video_source/test2.mp4"
}

# --- Batching & Queue Setup ---
BATCH_SIZE = len(VIDEO_MAP)
# Queue(maxsize=N) provides backpressure to stop readers from
# flooding memory if inference is the bottleneck.
frame_queue = queue.Queue(maxsize=BATCH_SIZE * 2)
results_queues = {loc: queue.Queue(maxsize=2) for loc in VIDEO_MAP}


# --- Global Shared State ---
# This dict is shared between all PostProcessor threads
last_1min_counts_per_location = {}
counts_lock = threading.Lock()


class StreamPostProcessor:
    """
    This class handles *everything* after inference for a single stream.
    - ByteTracking
    - Line Crossing
    - Count Aggregation
    - Annotation
    - Frame Encoding
    """
    def __init__(self, location, class_name_dict, results_queue):
        self.location = location
        self.class_name_dict = class_name_dict
        self.results_queue = results_queue  # Dedicated queue for this stream
        
        self.latest_frame = None
        self.running = True
        self.current_fps = 0.0

        # Per-stream state
        self.rolling_counts = deque()
        self.last_save_time = time.time()

        # Per-stream trackers and annotators
        self.byte_tracker = sv.ByteTrack(frame_rate=30)
        self.box_annotator = sv.BoxAnnotator(thickness=1)
        # self.trace_annotator = sv.TraceAnnotator(thickness=2, trace_length=15) # <--- REMOVED

        # Line counter
        self.line_counter = sv.LineZone(
            start=sv.Point(0, int(STANDARD_SIZE[1] * 0.75)),
            end=sv.Point(STANDARD_SIZE[0], int(STANDARD_SIZE[1] * 0.75))
        )
        self.line_zone_annotator = sv.LineZoneAnnotator( 
            thickness=2, text_thickness=0, text_scale=0
        )
        
        self.thread = threading.Thread(target=self._run, daemon=True)

    def start(self):
        self.thread.start()

    def stop(self):
        self.running = False
        # Put a dummy item to unblock the queue.get()
        self.results_queue.put(None) 
        if self.thread.is_alive():
            self.thread.join(timeout=1)

    def get_latest_frame(self):
        return self.latest_frame

    def _run(self):
        while self.running:
            start_time = time.time() # Start FPS timer
            
            # 1. Get processed results from the inference worker
            item = self.results_queue.get()
            if item is None or not self.running:
                break
                
            frame, results = item
            
            # --- PROFILING START ---
            t1 = time.time()

            # 2. Process Detections
            detections = sv.Detections.from_ultralytics(results)
            detections = self.byte_tracker.update_with_detections(detections)

            # 3. Trigger Line Counter (Keep logic for DB saving)
            frame_counts = {cls: 0 for cls in self.class_name_dict.values()}
            _, crossed_out = self.line_counter.trigger(detections)
            for idx in np.where(crossed_out)[0]:
                class_id = int(detections.class_id[idx])
                class_name = self.class_name_dict[class_id]
                frame_counts[class_name] += 1
            frame_counts["Total"] = sum(frame_counts.values())

            # 4. Annotate Frame <--- MODIFIED
            # We still draw boxes, but not traces or the line
            annotated_frame = self.box_annotator.annotate(scene=frame.copy(), detections=detections)
            annotated_frame = self.line_zone_annotator.annotate(annotated_frame, line_counter=self.line_counter) 

            # 5. Aggregate Rolling Counts (Keep logic for DB saving)
            now = time.time()
            self.rolling_counts.append((now, frame_counts))
            while self.rolling_counts and now - self.rolling_counts[0][0] > ROLLING_WINDOW:
                self.rolling_counts.popleft()

            sum_counts = {cls: 0 for cls in self.class_name_dict.values()}
            for _, counts in self.rolling_counts:
                for cls in self.class_name_dict.values():
                    sum_counts[cls] += counts.get(cls, 0)
            sum_counts["Total"] = sum(sum_counts[cls] for cls in self.class_name_dict.values())

            # 6. Save latest for frontend (Keep logic)
            with counts_lock:
                last_1min_counts_per_location[self.location] = sum_counts

            # 7. Save to DB every 60s (Keep logic)
            if now - self.last_save_time >= 60:
                threading.Thread(target=save_counts_to_mongo, args=(sum_counts, self.location), daemon=True).start()
                self.last_save_time = now
            
            # 8. Calculate FPS
            end_time = time.time()
            delta = end_time - start_time
            if delta > 0:
                self.current_fps = 1.0 / delta

            # 9. Draw Overlay Counts (top-left) <--- MODIFIED
            try:
                # Only create the FPS line
                lines = [f"FPS: {self.current_fps:.1f}"]

                font = cv2.FONT_HERSHEY_SIMPLEX
                scale = 0.6
                thickness = 2
                padding = 8
                line_spacing = 6
                
                # Measure text size for the single FPS line
                text_sizes = [cv2.getTextSize(l, font, scale, thickness)[0] for l in lines]
                max_w = max(w for w, h in text_sizes)
                total_h = sum(h for w, h in text_sizes) + (len(lines) - 1) * line_spacing
                x0, y0 = 10, 10
                rect_x1, rect_y1 = max(x0 - padding, 0), max(y0 - padding, 0)
                rect_x2, rect_y2 = min(x0 + max_w + padding, STANDARD_SIZE[0]), min(y0 + total_h + padding, STANDARD_SIZE[1])
                
                overlay = annotated_frame.copy()
                cv2.rectangle(overlay, (rect_x1, rect_y1), (rect_x2, rect_y2), (30, 30, 30), -1)
                alpha = 0.6
                cv2.addWeighted(overlay, alpha, annotated_frame, 1 - alpha, 0, annotated_frame)

                # Draw the single FPS line
                y = y0 + text_sizes[0][1]
                for i, text in enumerate(lines):
                    cv2.putText(annotated_frame, text, (x0, y), font, scale, (0, 0, 0), thickness + 2, cv2.LINE_AA)
                    cv2.putText(annotated_frame, text, (x0, y), font, scale, (200, 230, 110), thickness, cv2.LINE_AA)
                    # No need for y increment if there's only one line, but this is fine

            except Exception as e:
                print(f"[{self.location}] Draw overlay error: {e}")
                pass

            t2 = time.time()
            #print(f"[{self.location}] Postproc took {t2 - t1:.3f}s, FPS={self.current_fps:.2f}")
            
            # 10. Encode Frame for Streaming
            ret, buffer = cv2.imencode('.jpg', annotated_frame)
            if ret:
                self.latest_frame = (b'--frame\r\n'
                                      b'Content-Type: image/jpeg\r\n\r\n' +
                                      buffer.tobytes() + b'\r\n')
            
            # Yield to other threads
            time.sleep(0.001)


def video_reader_worker(location, video_path, frame_queue):
    """
    Reads frames from a video source and puts them into the shared frame_queue.
    Pushes frames as fast as they are read from the video (uncapped FPS).
    """
    print(f"[{location}] Reader thread started...")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[{location}] Could not open video: {video_path}")
        return

    while True:
        try:
            success, frame = cap.read()
            if not success:
                print(f"[{location}] End of video, re-opening...")
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            frame_resized = cv2.resize(frame, STANDARD_SIZE)
            frame_queue.put((location, frame_resized))

            # Small sleep to prevent 100% CPU usage
            time.sleep(0.001)

        except Exception as e:
            print(f"[{location}] Reader error: {e}")
            time.sleep(1)




def inference_worker(model, frame_queue, results_queues, batch_size):
    """
    Pulls frames from the frame_queue, runs batched inference,
    and distributes results to the correct post-processing queues.
    """
    print("Inference worker started...")
    while True:
        batch_frames = []
        batch_locations = []
        
        # 1. Wait for the first frame to start a batch
        try:
            location, frame = frame_queue.get(timeout=1)
            batch_frames.append(frame)
            batch_locations.append(location)
        except queue.Empty:
            continue # No frames, wait again

        # 2. Try to fill the rest of the batch without blocking
        while len(batch_frames) < batch_size:
            try:
                loc, frm = frame_queue.get_nowait()
                batch_frames.append(frm)
                batch_locations.append(loc)
            except queue.Empty:
                break # Queue is empty, run inference on the partial batch
        
        # 3. Run batched inference
        if batch_frames:
            try:
                # --- PROFILING START ---
                t0 = time.time()
                results_list = model(batch_frames, verbose=False, imgsz=224)
                t1 = time.time()
                print(f"[Inference] Batch {len(batch_frames)} took {t1 - t0:.3f}s")
                # --- PROFILING END ---
                
                # 4. Distribute results to the correct post-processor
                for i, results in enumerate(results_list):
                    loc = batch_locations[i]
                    frm = batch_frames[i]
                    results_queues[loc].put((frm.copy(), results.cpu()))
            
            except Exception as e:
                print(f"[Inference] Error processing batch: {e}")



# --- Main Application Setup ---

print("Loading global YOLO model...")
model = YOLO(MODEL_PATH)
# model.to('cuda') # uncomment to use GPU
CLASS_NAME_DICT = model.model.names
print(f"Model loaded. Classes: {CLASS_NAME_DICT}")


# 1. Start the single Inference Worker
threading.Thread(
    target=inference_worker,
    args=(model, frame_queue, results_queues, BATCH_SIZE),
    daemon=True
).start()


# 2. Start one PostProcessor for each video stream
post_processors = {}
for loc in VIDEO_MAP.keys():
    pp = StreamPostProcessor(loc, CLASS_NAME_DICT, results_queues[loc])
    pp.start()
    post_processors[loc] = pp
    print(f"Started post-processor for: {loc}")


# 3. Start one VideoReader for each video stream
for loc, path in VIDEO_MAP.items():
    threading.Thread(
        target=video_reader_worker,
        args=(loc, path, frame_queue),
        daemon=True
    ).start()
    print(f"Started video reader for: {loc}")
