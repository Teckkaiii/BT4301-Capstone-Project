# ======================================
# Flask Routes
# ======================================

from flask import jsonify, render_template, Response
from modules.yolo_processing import post_processors, last_1min_counts_per_location
from modules.utils import (
    get_congestion_level,
    get_traffic_volume_trends,
    get_hourly_counts_per_location,
    get_all_locations_congestion,
    get_vehicle_type_distribution,
    get_peak_hour_analysis,
    get_flow_efficiency,
    get_heavy_vehicle_counts_per_location
)
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


    @app.route('/api/traffic_trends')
    def api_traffic_trends():
        """(Chart 1) Serves hourly trends for the last 8 hours."""
        data = get_traffic_volume_trends(hours=8)
        return jsonify(data)

    @app.route('/api/hourly_counts_by_location')
    def api_hourly_counts_by_location():
        data = get_hourly_counts_per_location(hours=8, key_format='chart')
        return jsonify(data)

    @app.route('/api/congestion_by_location')
    def api_congestion_by_location():
        """(Chart 2) Serves congestion for all locations (last 60 min)."""
        data = get_all_locations_congestion(interval_minutes=1440)
        return jsonify(data)

    @app.route('/api/vehicle_distribution')
    def api_vehicle_distribution():
        """(Chart 4) Serves vehicle type breakdown for today."""
        data = get_vehicle_type_distribution(today=True)
        return jsonify(data)
        
    @app.route('/api/peak_hour')
    def api_peak_hour():
        """(Chart 3) Serves vehicle breakdown for the day's peak hour."""
        data = get_peak_hour_analysis(today=True)
        return jsonify(data)

    @app.route('/api/flow_efficiency')
    def api_flow_efficiency():
        """(Chart 6) Serves calculated flow efficiency."""
        data = get_flow_efficiency(interval_minutes=30)
        return jsonify(data)
    
    # Route for your new recommendations volume (needs location1, location2 keys)
    @app.route('/api/last_hour_volume')
    def api_last_hour_volume():
        # Pass key_format='raw' to get location1, location2, etc.
        data = get_hourly_counts_per_location(hours=1, key_format='raw') 
        return jsonify(data)
    
    @app.route('/api/heavy_vehicle_counts')
    def api_heavy_vehicle_counts():
        """
        Returns heavy vehicle counts (truck + bus) per location
        for use in the Recommendations tab.
        Default: last 1 hour.
        """
        data = get_heavy_vehicle_counts_per_location(interval_minutes=1440)
        print(data)
        return jsonify(data)


