import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import "./Analytics.css";

const API_URL = "http://localhost:5001"; 
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AA336A"];

const formatHour = (hour) => {
  if (hour === 0) return "12AM";
  if (hour === 12) return "12PM";
  if (hour < 12) return `${hour}AM`;
  return `${hour % 12}PM`;
};

function Analytics() {
  const [trafficTrend, setTrafficTrend] = useState([]);
  const [congestionByLocation, setCongestionByLocation] = useState([]);
  const [peakHour, setPeakHour] = useState([]);
  const [vehicleTypePie, setVehicleTypePie] = useState([]);
  const [countVsTime, setCountVsTime] = useState([]);
  const [flowEfficiency, setFlowEfficiency] = useState([]);

  useEffect(() => {
    const fetchAllAnalytics = async () => {
      try {
        const responses = await Promise.all([
          fetch(`${API_URL}/api/traffic_trends`),
          fetch(`${API_URL}/api/congestion_by_location`),
          fetch(`${API_URL}/api/peak_hour`),
          fetch(`${API_URL}/api/vehicle_distribution`),
          fetch(`${API_URL}/api/hourly_counts_by_location`),
          fetch(`${API_URL}/api/flow_efficiency`)
        ]);
        const data = await Promise.all(responses.map(res => res.json()));

        setTrafficTrend(data[0].map(d => ({ ...d, time: formatHour(d.time) })));
        setCongestionByLocation(data[1]);
        setPeakHour(data[2]);
        setVehicleTypePie(data[3]);
        setCountVsTime(data[4].map(d => ({ ...d, time: formatHour(d.time) })));
        setFlowEfficiency(data[5]);
      } catch (error) {
        console.error("Failed to fetch analytics data:", error);
      }
    };

    fetchAllAnalytics();
    const intervalId = setInterval(fetchAllAnalytics, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="analytics-grid">
      {/* Traffic Volume Trends */}
      <div className="chart-card">
        <h3>Traffic Volume Trends (Last 8 Hours)</h3>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={trafficTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend verticalAlign="top" align="center" iconSize={12} />
            <Line yAxisId="left" type="monotone" dataKey="vehicles" stroke="#8884d8" />
            <Line yAxisId="right" type="monotone" dataKey="congestion" stroke="#82ca9d" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Congestion by Location */}
      <div className="chart-card">
        <h3>Congestion by Location (Last hour)</h3>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={congestionByLocation}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="location" />
            <YAxis />
            <Tooltip />
            <Legend verticalAlign="top" align="right" iconSize={12} />
            <Bar dataKey="congestion" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Peak Hour Analysis */}
      <div className="chart-card">
        <h3>Peak Hour Analysis (Today)</h3>
        <ResponsiveContainer width="100%" height={230}>
          <RadarChart data={peakHour}>
            <PolarGrid />
            <PolarAngleAxis dataKey="vehicle" />
            <PolarRadiusAxis />
            <Legend verticalAlign="top" align="right" iconSize={12} />
            <Radar name="Count" dataKey="count" stroke="#FF8042" fill="#FF8042" fillOpacity={0.6} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Vehicle Type Pie Chart */}
      <div className="chart-card">
        <h3>Vehicle Type Distribution (Today)</h3>
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie
              data={vehicleTypePie}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              // label removed
            >
              {vehicleTypePie.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" align="center" iconSize={12} />
          </PieChart>
        </ResponsiveContainer>
      </div>


      {/* Count vs Time */}
      <div className="chart-card">
        <h3>Count vs Time per Location (Last 8 Hours)</h3>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={countVsTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend verticalAlign="top" align="right" iconSize={12} />
            <Line type="monotone" dataKey="A" stroke="#8884d8" />
            <Line type="monotone" dataKey="B" stroke="#82ca9d" />
            <Line type="monotone" dataKey="C" stroke="#FF8042" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Traffic Flow Efficiency */}
      <div className="chart-card">
        <h3>Traffic Flow Efficiency (Last 30 min)</h3>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={flowEfficiency}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="location" />
            <YAxis domain={[0, 1]} />
            <Tooltip />
            <Legend verticalAlign="top" align="right" iconSize={12} />
            <Bar dataKey="efficiency" fill="#00C49F" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default Analytics;
