import React from "react";

function AnalyticsDashboard() {
  // For now, display mock traffic counts
  const mockData = [
    { vehicle: "car", count: 120 },
    { vehicle: "bus", count: 30 },
    { vehicle: "motorbike", count: 50 },
  ];

  return (
    <div style={{ padding: "20px" }}>
      <h2>Traffic Analytics Dashboard</h2>
      <ul>
        {mockData.map((d, idx) => (
          <li key={idx}>
            {d.vehicle}: {d.count}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AnalyticsDashboard;
