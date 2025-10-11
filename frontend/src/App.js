import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import SideBar from "./components/SideBar";
import TopBanner from "./components/TopBanner";
import AppRouter from "./components/AppRouter";
import "./App.css";

function App() {
  const feeds = [
    { location: "Location A", congestion: 90, vehicles: { car: 215, bike: 606, bus: 6, truck: 24, auto: 205 } },
    { location: "Location B", congestion: 65, vehicles: { car: 180, bike: 400, bus: 10, truck: 18, auto: 120 } },
    { location: "Location C", congestion: 50, vehicles: { car: 120, bike: 350, bus: 8, truck: 15, auto: 90 } },
    { location: "Location D", congestion: 80, vehicles: { car: 200, bike: 500, bus: 12, truck: 20, auto: 150 } },
    { location: "Location E", congestion: 70, vehicles: { car: 190, bike: 450, bus: 10, truck: 18, auto: 140 } },
    { location: "Location F", congestion: 55, vehicles: { car: 130, bike: 360, bus: 9, truck: 12, auto: 95 } },
    { location: "Location G", congestion: 85, vehicles: { car: 210, bike: 520, bus: 15, truck: 22, auto: 180 } },
    { location: "Location H", congestion: 60, vehicles: { car: 150, bike: 380, bus: 10, truck: 14, auto: 100 } },
  ];

  return (
    <Router>
      <div className="main-layout">
        <SideBar />
        <div className="page-content">
          <TopBanner />
          <AppRouter feeds={feeds} />
        </div>
      </div>
    </Router>
  );
}

export default App;
