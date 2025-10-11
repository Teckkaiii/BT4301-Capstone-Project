import React from "react";
import "./LiveFeedContainer.css";

function LiveFeedContainer({ feed }) {
  const { location, congestion, vehicles } = feed;

  const congestionLevel = congestion > 75 ? "High" : congestion > 50 ? "Medium" : "Low";
  const congestionColor = congestion > 75 ? "#dc2626" : congestion > 50 ? "#f59e0b" : "#16a34a";

  return (
    <div className="live-feed-container">
      <h3>{location}</h3>
      <p className="congestion" style={{ backgroundColor: congestionColor }}>
        Congestion: {congestion}% ({congestionLevel})
      </p>
      <div className="video-wrapper">
        <video width="100%" height="180" controls>
          <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="vehicle-stats">
        {Object.entries(vehicles).map(([key, value]) => (
          <div key={key} className="vehicle-stat">
            <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {value}
          </div>
        ))}
      </div>
    </div>
  );
}

export default LiveFeedContainer;
