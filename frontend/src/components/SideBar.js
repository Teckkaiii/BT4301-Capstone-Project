import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./SideBar.css";

function SideBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Analytics", path: "/analytics" },
    { name: "Recommendations", path: "/recommendations" },
  ];

  return (
    <div className="sidebar">
      <h2 className="sidebar-title">Group 22</h2>
      {tabs.map((tab) => (
        <div
          key={tab.name}
          className={`sidebar-tab ${location.pathname === tab.path ? "active" : ""}`}
          onClick={() => navigate(tab.path)}
        >
          {tab.name}
        </div>
      ))}
    </div>
  );
}

export default SideBar;
