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
      {/* Title and subtitle at the top */}
      <div className="sidebar-header">
        <h3 className="sidebar-title">Traffic Management</h3>
        <h5 className="sidebar-subtitle">Smart City Platform</h5>
      </div>

      {/* Tabs below */}
      <div className="tabs-container">
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
    </div>
  );
}

export default SideBar;
