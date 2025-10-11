import React from "react";
import "./Recommendations.css";

function Recommendations() {
  const recs = [
    { title: "Signal time optimization", desc: "Adjust traffic signals dynamically for better flow." },
    { title: "Infrastructure expansion", desc: "Widen roads and add lanes in high congestion areas." },
    { title: "Truck restrictions during peak hours", desc: "Limit heavy vehicles to off-peak times." },
    { title: "Promote alternative transport", desc: "Encourage cycling, walking, and public transport." },
  ];

  return (
    <div className="rec-grid">
      {recs.map(r => (
        <div key={r.title} className="rec-card">
          <h3>{r.title}</h3>
          <p>{r.desc}</p>
        </div>
      ))}
    </div>
  );
}

export default Recommendations;
