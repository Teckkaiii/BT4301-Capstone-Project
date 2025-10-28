import React from "react";
import { useParams } from "react-router-dom";
import "./LocationDetail.css";

const API_BASE = "http://localhost:5001"; // adjust if needed

function LocationDetail() {
  const { locationName } = useParams();

  // Keep your previous dummy stats
  const dummyStats = [
    "Total vehicles: 1234",
    "Vehicles per hour: 210",
    "Average speed: 35 km/h",
    "Congestion level: 78%"
  ];

  // Build the MJPEG video feed URL
  const videoSrc = `${API_BASE}/video_feed/${encodeURIComponent(locationName)}`;

  return (
    <div className="location-detail">
      <div className="video-section">
        <img
          src={videoSrc}
          alt={`Live Traffic Feed - ${locationName}`}
          width="100%"
          height="100%"
          style={{ borderRadius: 10 }}
          onError={() => console.error("Video failed:", videoSrc)}
        />
      </div>

      <div className="stats-section">
        {dummyStats.map(stat => (
          <div key={stat} className="stat-card">
            {stat}
          </div>
        ))}
      </div>
    </div>
  );
}

export default LocationDetail;
