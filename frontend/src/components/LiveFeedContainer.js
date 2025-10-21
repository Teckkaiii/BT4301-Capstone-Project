import React, { useEffect, useState } from "react";
import "./LiveFeedContainer.css";

function LiveFeedContainer() {
  const [feed, setFeed] = useState(null);

  // Fetch live counts and congestion every 3 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [countsRes, congestionRes] = await Promise.all([
          fetch("http://localhost:5001/current_counts"),
          fetch("http://localhost:5001/congestion")
        ]);

        const countsData = await countsRes.json();
        const congestionData = await congestionRes.json();

        setFeed({
          location: "Main Road",
          congestion: congestionData.average_vehicles,
          vehicles: countsData,
        });
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000); // poll every 3s
    return () => clearInterval(interval);
  }, []);

  // Early return for loading state
  if (!feed) {
    return <p>Loading live traffic feed...</p>;
  }

  // Safely destructure feed
  const { location, congestion, vehicles = {} } = feed;
  const congestionLevel =
    congestion > 50 ? (congestion > 75 ? "High" : "Medium") : "Low";
  const congestionColor =
    congestion > 75 ? "#dc2626" : congestion > 50 ? "#f59e0b" : "#16a34a";

  return (
    <div className="live-feed-container">
      <h3>{location}</h3>
      <p
        className="congestion"
        style={{ backgroundColor: congestionColor }}
      >
        Congestion: {congestion.toFixed(1)} ({congestionLevel})
      </p>

      {/* 🔴 Live Video Stream */}
      <div className="video-wrapper">
        <img
          src="http://localhost:5001/video_feed"
          alt="Live Traffic Feed"
          width="100%"
          height="180"
          style={{ borderRadius: "8px" }}
        />
      </div>

      {/* 🚗 Vehicle Statistics */}
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
