/* import React, { useEffect, useState } from "react";
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

      
      <div className="video-wrapper">
        <img
          src="http://localhost:5001/video_feed/location1"
          alt="Live Traffic Feed"
          width="100%"
          height="180"
          style={{ borderRadius: "8px" }}
        />
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
*/
import React, { useEffect, useState } from "react";
import "./LiveFeedContainer.css";

const API_BASE = "http://localhost:5001"; // adjust if needed

function LiveFeedContainer({ feed }) {
  const key = feed?.key;               // backend key: e.g., "location1"
  const label = feed?.label || key;    // UI label

  const [live, setLive] = useState({
    congestion: 0,
    vehicles: {},
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!key) return;

    let cancel = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setErr(null);

        const [countsRes, congestionRes] = await Promise.all([
          fetch(`${API_BASE}/current_counts/${encodeURIComponent(key)}`),
          fetch(`${API_BASE}/congestion/${encodeURIComponent(key)}`),
        ]);

        if (!countsRes.ok) throw new Error(`counts ${countsRes.status}`);
        if (!congestionRes.ok) throw new Error(`congestion ${congestionRes.status}`);

        const countsJson = await countsRes.json();
        const congJson = await congestionRes.json();

        const vehicles = countsJson?.counts ?? countsJson ?? {};
        const congestion =
          congJson?.avg_vehicle_count ??
          congJson?.average_vehicles ??
          congJson?.congestion ??
          (typeof congJson === "number" ? congJson : 0);

        if (!cancel) setLive({ congestion, vehicles });
      } catch (e) {
        if (!cancel) setErr(e.message || "Failed to fetch");
      } finally {
        if (!cancel) setLoading(false);
      }
    };

    fetchData();
    const id = setInterval(fetchData, 3000);
    return () => {
      cancel = true;
      clearInterval(id);
    };
  }, [key]);

  const congestionLevel =
    live.congestion > 75 ? "High" : live.congestion > 50 ? "Medium" : "Low";
  const congestionColor =
    live.congestion > 75 ? "#dc2626" : live.congestion > 50 ? "#f59e0b" : "#16a34a";

  const imgSrc = `${API_BASE}/video_feed/${encodeURIComponent(key)}`;

  return (
    <div className="live-feed-container">
      <h3>{label}</h3>

      {err && <p style={{ color: "#dc2626" }}>Error: {err}</p>}
      {loading && <p>Updating…</p>}

      <p className="congestion" style={{ backgroundColor: congestionColor }}>
        Congestion: {Number.isFinite(live.congestion) ? live.congestion.toFixed(1) : "—"} ({congestionLevel})
      </p>

      {/* 🔴 MJPEG stream from Flask */}
      <div className="video-wrapper">
        <img
          src={imgSrc}
          alt={`Live Traffic Feed - ${label}`}
          width="100%"
          height="180"
          style={{ borderRadius: 8 }}
          onError={() => console.error("Video failed:", imgSrc)}
        />
      </div>

      <div className="vehicle-stats">
        {Object.entries(live.vehicles).map(([k, v]) => (
          <div key={k} className="vehicle-stat">
            <strong>{k.charAt(0).toUpperCase() + k.slice(1)}:</strong> {v}
          </div>
        ))}
      </div>
    </div>
  );
}

export default LiveFeedContainer;
