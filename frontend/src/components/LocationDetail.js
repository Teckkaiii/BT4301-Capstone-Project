import React from "react";
import { useParams } from "react-router-dom";
import "./LocationDetail.css";

function LocationDetail() {
  const { locationName } = useParams();
  const dummyStats = [
    "Total vehicles: 1234",
    "Vehicles per hour: 210",
    "Average speed: 35 km/h",
    "Congestion level: 78%"
  ];

  return (
    <div className="location-detail">
      <div className="video-section">
        <video width="100%" height="100%" controls autoPlay>
          <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="stats-section">
        {dummyStats.map(stat => (
          <div key={stat} className="stat-card">
            <span>{stat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LocationDetail;
