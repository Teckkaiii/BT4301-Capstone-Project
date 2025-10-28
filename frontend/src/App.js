import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import SideBar from "./components/SideBar";
import TopBanner from "./components/TopBanner";
import AppRouter from "./components/AppRouter";
import "./App.css";

function App() {
  const feeds = [
  { key: "location1", label: "Location 1" },
  { key: "location2", label: "Location 2" },
  { key: "location3", label: "Location 3" }
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
