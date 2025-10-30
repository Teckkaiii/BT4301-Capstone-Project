# ======================================
# Flask Routes
# ======================================

from flask import jsonify, render_template, Response
from modules.yolo_processing import post_processors, last_1min_counts_per_location
from modules.utils import get_congestion_level
import time

def init_routes(app):
    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/video_feed/<location>')
    def video_feed(location):
        vp = post_processors.get(location)
        if not vp:
            return jsonify({"error": f"Invalid location '{location}'"}), 404

        def frame_generator():
            while True:
                frame = vp.get_latest_frame()
                if frame:
                    yield frame
                else:
                    time.sleep(0.01)

        return Response(
            frame_generator(),
            mimetype='multipart/x-mixed-replace; boundary=frame'
        )

    @app.route('/current_counts/<location>')
    def current_counts(location):
        counts = last_1min_counts_per_location.get(location, {})
        return jsonify({"location": location, "counts": counts})

    @app.route('/congestion/<location>')
    def congestion(location):
        data = get_congestion_level(location, interval_minutes=5)
        return jsonify(data)
