from ultralytics import YOLO
import supervision as sv
import cv2
import numpy as np
import time
import threading
from collections import deque
from modules.database import save_counts_to_mongo

STANDARD_SIZE = (640, 480)
ROLLING_WINDOW = 60
last_1min_counts_per_location = {}
counts_lock = threading.Lock()  # protect the shared dict

# Load path only (do NOT create a single global model/trackers)
MODEL_PATH = "Models/best (test model).pt"


class VideoProcessor:
    def __init__(self, video_path, location):
        self.video_path = video_path
        self.location = location
        self.latest_frame = None
        self.rolling_counts = deque()
        self.last_save_time = time.time()
        self.running = True

        # Per-instance model and trackers (safer for threads)
        self.model = YOLO(MODEL_PATH)
        self.byte_tracker = sv.ByteTrack(frame_rate=30)
        self.box_annotator = sv.BoxAnnotator(thickness=1)
        self.trace_annotator = sv.TraceAnnotator(thickness=2, trace_length=15)
        self.class_name_dict = self.model.model.names

        self.thread = threading.Thread(target=self._process_video, daemon=True)

        # Line counter
        self.line_counter = sv.LineZone(
            start=sv.Point(0, int(STANDARD_SIZE[1] * 0.75)),
            end=sv.Point(STANDARD_SIZE[0], int(STANDARD_SIZE[1] * 0.75))
        )
        self.line_zone_annotator = sv.LineZoneAnnotator(
            thickness=2, text_thickness=0, text_scale=0
        )

    def start(self):
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread.is_alive():
            self.thread.join(timeout=1)

    def get_latest_frame(self):
        return self.latest_frame

    def _process_frame(self, frame):
        results = self.model(frame, verbose=False)[0]
        detections = sv.Detections.from_ultralytics(results)
        detections = self.byte_tracker.update_with_detections(detections)

        frame_counts = {cls: 0 for cls in self.class_name_dict.values()}

        _, crossed_out = self.line_counter.trigger(detections)
        for idx in np.where(crossed_out)[0]:
            class_id = int(detections.class_id[idx])
            class_name = self.class_name_dict[class_id]
            frame_counts[class_name] += 1

        frame_counts["Total"] = sum(frame_counts.values())

        annotated_frame = self.trace_annotator.annotate(scene=frame.copy(), detections=detections)
        annotated_frame = self.box_annotator.annotate(scene=annotated_frame, detections=detections)
        annotated_frame = self.line_zone_annotator.annotate(annotated_frame, line_counter=self.line_counter)

        return annotated_frame, frame_counts

    def _process_video(self):
        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            print(f"[{self.location}] Could not open video: {self.video_path}")
            return

        while self.running:
            success, frame = cap.read()
            if not success:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            frame = cv2.resize(frame, STANDARD_SIZE)
            try:
                processed_frame, frame_counts = self._process_frame(frame)
            except Exception as e:
                print(f"[{self.location}] processing error: {e}")
                continue

            now = time.time()
            self.rolling_counts.append((now, frame_counts))

            while self.rolling_counts and now - self.rolling_counts[0][0] > ROLLING_WINDOW:
                self.rolling_counts.popleft()

            # Sum rolling counts
            sum_counts = {cls: 0 for cls in self.class_name_dict.values()}
            for _, counts in self.rolling_counts:
                for cls in self.class_name_dict.values():
                    sum_counts[cls] += counts.get(cls, 0)
            sum_counts["Total"] = sum(sum_counts[cls] for cls in self.class_name_dict.values())

            # Save latest for frontend (use lock)
            with counts_lock:
                last_1min_counts_per_location[self.location] = sum_counts

            # Save to DB every 60s
            if now - self.last_save_time >= 60:
                threading.Thread(target=save_counts_to_mongo, args=(sum_counts, self.location), daemon=True).start()
                self.last_save_time = now

            # --- Draw overlay counts (top-left) ---
            try:
                # prepare display lines (classes then Total)
                display_classes = list(self.class_name_dict.values()) + ["Total"]
                lines = [f"{cls}: {sum_counts.get(cls, 0)}" for cls in display_classes]

                font = cv2.FONT_HERSHEY_SIMPLEX
                scale = 0.6
                thickness = 2
                padding = 8
                line_spacing = 6

                # measure text sizes
                text_sizes = [cv2.getTextSize(l, font, scale, thickness)[0] for l in lines]
                max_w = max(w for w, h in text_sizes)
                total_h = sum(h for w, h in text_sizes) + (len(lines) - 1) * line_spacing

                # background rectangle (top-left)
                x0 = 10
                y0 = 10
                rect_x1 = max(x0 - padding, 0)
                rect_y1 = max(y0 - padding, 0)
                rect_x2 = min(x0 + max_w + padding, STANDARD_SIZE[0])
                rect_y2 = min(y0 + total_h + padding, STANDARD_SIZE[1])

                # draw translucent background
                overlay = processed_frame.copy()
                cv2.rectangle(overlay, (rect_x1, rect_y1), (rect_x2, rect_y2), (30, 30, 30), -1)
                alpha = 0.6
                cv2.addWeighted(overlay, alpha, processed_frame, 1 - alpha, 0, processed_frame)

                # draw texts with outline (black shadow then colored foreground)
                y = y0 + text_sizes[0][1]
                for i, text in enumerate(lines):
                    cv2.putText(processed_frame, text, (x0, y), font, scale, (0, 0, 0), thickness + 2, cv2.LINE_AA)   # outline
                    cv2.putText(processed_frame, text, (x0, y), font, scale, (200, 230, 110), thickness, cv2.LINE_AA) # foreground (soft green)
                    y += text_sizes[i][1] + line_spacing

                processed_frame = processed_frame
            except Exception:
                pass
            # --- end overlay ---

            # Encode frame for streaming
            ret, buffer = cv2.imencode('.jpg', processed_frame)
            if ret:
                self.latest_frame = (b'--frame\r\n'
                                     b'Content-Type: image/jpeg\r\n\r\n' +
                                     buffer.tobytes() + b'\r\n')

            time.sleep(0.01)

        cap.release()


# Initialize processors for multiple videos (unchanged)
VIDEO_MAP = {
    "location1": "video_source/test.mp4",
    "location2": "video_source/test1.mp4",
    "location3": "video_source/test2.mp4"
}

video_processors = {}
for loc, path in VIDEO_MAP.items():
    vp = VideoProcessor(video_path=path, location=loc)
    vp.start()
    video_processors[loc] = vp


def generate_frames(video_path, location):
    """Return latest frames for frontend streaming."""
    vp = video_processors.get(location)
    while True:
        frame = vp.get_latest_frame()
        if frame:
            yield frame
        else:
            time.sleep(0.05)
