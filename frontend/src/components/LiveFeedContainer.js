import { useEffect, useState } from "react";
import "./LiveFeedContainer.css";

const API_BASE = "http://localhost:5001";

function LiveFeedContainer({ feed }) {
  const key = feed?.key;
  const label = feed?.label || key;

  const [live, setLive] = useState({
    congestion: 0,
    vehicles: {},
  });
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!key) return;

    let cancel = false;

    const fetchData = async () => {
      try {
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

      <p className="congestion" style={{ backgroundColor: congestionColor }}>
        Congestion: {Number.isFinite(live.congestion) ? live.congestion.toFixed(1) : "—"} ({congestionLevel})
      </p>

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
        {Object.entries(live.vehicles)
          .sort(([a], [b]) => (a === "Total" ? 1 : b === "Total" ? -1 : 0))
          .map(([k, v]) => (
            <div key={k} className="vehicle-stat">
              <strong>{k.charAt(0).toUpperCase() + k.slice(1)}:</strong> {v}
            </div>
          ))}
      </div>
    </div>
  );
}

export default LiveFeedContainer;
