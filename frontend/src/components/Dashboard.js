// src/components/Dashboard.js
import React from "react";
import { Link } from "react-router-dom";
import LiveFeedContainer from "./LiveFeedContainer";
import "./Dashboard.css";

function Dashboard({ feeds }) {
  return (
    <div className="dashboard-grid">
      {feeds.map((feed, index) => (
        <Link
          key={index}
          to={`/location/${feed.location.replace(" ", "")}`} // e.g., LocationA
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <LiveFeedContainer feed={feed} />
        </Link>
      ))}
    </div>
  );
}

export default Dashboard;
