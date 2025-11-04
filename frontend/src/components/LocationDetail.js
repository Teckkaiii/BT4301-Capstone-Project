import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import "./LocationDetail.css";

const API_BASE = "http://localhost:5001";

function LocationDetail() {
  const { locationName } = useParams();
  const [counts, setCounts] = useState({});
  const [congestion, setCongestion] = useState(null);

  const videoSrc = `${API_BASE}/video_feed/${encodeURIComponent(locationName)}`;

  // ✅ Memoize fetchData so dependency is stable
  const fetchData = useCallback(async () => {
    try {
      const [cRes, congRes] = await Promise.all([
        fetch(`${API_BASE}/current_counts/${encodeURIComponent(locationName)}`).then(r => r.json()),
        fetch(`${API_BASE}/congestion/${encodeURIComponent(locationName)}`).then(r => r.json())
      ]);

      setCounts(cRes.counts || {});
      setCongestion(congRes || {});
    } catch (err) {
      console.error("Failed to fetch real-time stats:", err);
    }
  }, [locationName]); // ✅ correct dependency

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]); // ✅ no ESLint warning

  return (
    <div className="location-detail">
      <div className="video-section">
        <img
          src={videoSrc}
          alt={`Live Traffic Feed - ${locationName}`}
          style={{ width: "100%", height: "100%", borderRadius: 10 }}
        />
      </div>

      <div className="stats-section">
        <div className="stat-card">Total: {counts.Total ?? 0}</div>

        {Object.entries(counts)
          .filter(([k]) => k !== "Total")
          .map(([k, v]) => (
            <div key={k} className="stat-card">
              {k}: {v}
            </div>
          ))}

        {congestion && (
          <>
            <div className="stat-card"> Congestion Level: {congestion.level}</div>
            <div className="stat-card">
              Average: {congestion.average_vehicles?.toFixed(2)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default LocationDetail;
