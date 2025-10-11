import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import LocationDetail from "./LocationDetail";
import Analytics from "./Analytics";
import Recommendations from "./Recommendations";

function AppRouter({ feeds }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={<Dashboard feeds={feeds} />} />
      <Route path="/location/:locationName" element={<LocationDetail />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/recommendations" element={<Recommendations />} />
    </Routes>
  );
}

export default AppRouter;
