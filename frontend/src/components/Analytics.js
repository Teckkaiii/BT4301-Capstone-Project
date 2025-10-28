import React, { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
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
  // Create state for all 6 charts
  const [trafficTrend, setTrafficTrend] = useState([]);
  const [congestionByLocation, setCongestionByLocation] = useState([]);
  const [peakHour, setPeakHour] = useState([]);
  const [vehicleTypePie, setVehicleTypePie] = useState([]);
  const [countVsTime, setCountVsTime] = useState([]);
  const [flowEfficiency, setFlowEfficiency] = useState([]);

  // Fetch all data on component mount
  useEffect(() => {
    const fetchAllAnalytics = async () => {
      try {
        // Use Promise.all to fetch all data in parallel
        const responses = await Promise.all([
          fetch(`${API_URL}/api/traffic_trends`),
          fetch(`${API_URL}/api/congestion_by_location`),
          fetch(`${API_URL}/api/peak_hour`),
          fetch(`${API_URL}/api/vehicle_distribution`),
          fetch(`${API_URL}/api/hourly_counts_by_location`),
          fetch(`${API_URL}/api/flow_efficiency`)
        ]);

        // Parse all responses as JSON
        const data = await Promise.all(responses.map(res => res.json()));
        
        // --- Set state for each chart ---
        
        // 1. Traffic Trend (format the 'time' key)
        const formattedTrend = data[0].map(d => ({ ...d, time: formatHour(d.time) }));
        setTrafficTrend(formattedTrend);

        // 2. Congestion by Location
        setCongestionByLocation(data[1]);

        // 3. Peak Hour
        setPeakHour(data[2]);

        // 4. Vehicle Type Pie
        setVehicleTypePie(data[3]);
        
        // 5. Count vs Time (format the 'time' key)
        const formattedCountVsTime = data[4].map(d => ({ ...d, time: formatHour(d.time) }));
        setCountVsTime(formattedCountVsTime);

        // 6. Flow Efficiency
        setFlowEfficiency(data[5]);

      } catch (error) {
        console.error("Failed to fetch analytics data:", error);
      }
    };

    fetchAllAnalytics();
    
    // Optional: Set an interval to refresh the data every 5 minutes
    const intervalId = setInterval(fetchAllAnalytics, 5 * 60 * 1000); // 5 minutes
    
    // Clear interval on cleanup
    return () => clearInterval(intervalId);
    
  }, []); // Empty array means this runs once on mount

  
  return (
    <div className="analytics-grid">
      {/* Traffic Volume Trends */}
      <div className="chart-card">
        <h3>Traffic Volume Trends (Last 8 Hours)</h3>
        <LineChart width={300} height={250} data={trafficTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="vehicles" stroke="#8884d8" />
          <Line yAxisId="right" type="monotone" dataKey="congestion" stroke="#82ca9d" />
        </LineChart>
      </div>

      {/* Congestion by Location */}
      <div className="chart-card">
        <h3>Congestion by Location (Last 5 min)</h3>
        <BarChart width={300} height={250} data={congestionByLocation}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="location" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="congestion" fill="#8884d8" />
        </BarChart>
      </div>

      {/* Peak Hour Analysis */}
      <div className="chart-card">
        <h3>Peak Hour Analysis (Today)</h3>
        <RadarChart outerRadius={100} width={300} height={250} data={peakHour}>
          <PolarGrid />
          <PolarAngleAxis dataKey="vehicle" />
          <PolarRadiusAxis />
          <Radar name="Count" dataKey="count" stroke="#FF8042" fill="#FF8042" fillOpacity={0.6} />
        </RadarChart>
      </div>

      {/* Vehicle Type Pie Chart */}
      <div className="chart-card">
        <h3>Vehicle Type Distribution (Today)</h3>
        <PieChart width={300} height={250}>
          <Pie
            data={vehicleTypePie}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            fill="#8884d8"
            label
          >
            {vehicleTypePie.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </div>

      {/* Count vs Time */}
      <div className="chart-card">
        <h3>Count vs Time per Location (Last 8 Hours)</h3>
        <LineChart width={300} height={250} data={countVsTime}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="A" stroke="#8884d8" />
          <Line type="monotone" dataKey="B" stroke="#82ca9d" />
          <Line type="monotone" dataKey="C" stroke="#FF8042" />
        </LineChart>
      </div>

      {/* Traffic Flow Efficiency */}
      <div className="chart-card">
        <h3>Traffic Flow Efficiency (Last 30 min)</h3>
        <BarChart width={300} height={250} data={flowEfficiency}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="location" />
          <YAxis domain={[0, 1]} />
          <Tooltip />
          <Legend />
          <Bar dataKey="efficiency" fill="#00C49F" />
        </BarChart>
      </div>
    </div>
  );
}

export default Analytics;

// import React from "react";
// import {
//   LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
//   BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
// } from "recharts";
// import "./Analytics.css";

// function Analytics() {
//   // Dummy data
//   const trafficTrend = [
//     { time: "8AM", vehicles: 120, congestion: 70 },
//     { time: "9AM", vehicles: 200, congestion: 85 },
//     { time: "10AM", vehicles: 180, congestion: 65 },
//     { time: "11AM", vehicles: 150, congestion: 50 },
//   ];

//   const congestionByLocation = [
//     { location: "A", congestion: 50 },
//     { location: "B", congestion: 65 },
//     { location: "C", congestion: 50 },
//     { location: "D", congestion: 90 },
//   ];

//   const peakHour = [
//     { vehicle: "Car", count: 500 },
//     { vehicle: "Bike", count: 600 },
//     { vehicle: "Bus", count: 50 },
//     { vehicle: "Truck", count: 80 },
//     { vehicle: "Auto", count: 200 },
//   ];

//   const vehicleTypePie = [
//     { name: "Car", value: 215 },
//     { name: "Bike", value: 606 },
//     { name: "Bus", value: 6 },
//     { name: "Truck", value: 24 },
//     { name: "Auto", value: 205 },
//   ];

//   const countVsTime = [
//     { time: "8AM", A: 50, B: 40, C: 60 },
//     { time: "9AM", A: 70, B: 55, C: 80 },
//     { time: "10AM", A: 65, B: 60, C: 75 },
//     { time: "11AM", A: 80, B: 70, C: 90 },
//   ];

//   const flowEfficiency = [
//     { location: "A", efficiency: 0.8 },
//     { location: "B", efficiency: 0.6 },
//     { location: "C", efficiency: 0.9 },
//     { location: "D", efficiency: 0.7 },
//   ];

//   const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AA336A"];

//   return (
//     <div className="analytics-grid">
//       {/* Traffic Volume Trends */}
//       <div className="chart-card">
//         <h3>Traffic Volume Trends</h3>
//         <LineChart width={300} height={250} data={trafficTrend}>
//           <CartesianGrid strokeDasharray="3 3" />
//           <XAxis dataKey="time" />
//           <YAxis yAxisId="left" />
//           <YAxis yAxisId="right" orientation="right" />
//           <Tooltip />
//           <Legend />
//           <Line yAxisId="left" type="monotone" dataKey="vehicles" stroke="#8884d8" />
//           <Line yAxisId="right" type="monotone" dataKey="congestion" stroke="#82ca9d" />
//         </LineChart>
//       </div>

//       {/* Congestion by Location */}
//       <div className="chart-card">
//         <h3>Congestion by Location</h3>
//         <BarChart width={300} height={250} data={congestionByLocation}>
//           <CartesianGrid strokeDasharray="3 3" />
//           <XAxis dataKey="location" />
//           <YAxis />
//           <Tooltip />
//           <Legend />
//           <Bar dataKey="congestion" fill="#8884d8" />
//         </BarChart>
//       </div>

//       {/* Peak Hour Analysis */}
//       <div className="chart-card">
//         <h3>Peak Hour Analysis</h3>
//         <RadarChart outerRadius={100} width={300} height={250} data={peakHour}>
//           <PolarGrid />
//           <PolarAngleAxis dataKey="vehicle" />
//           <PolarRadiusAxis />
//           <Radar name="Count" dataKey="count" stroke="#FF8042" fill="#FF8042" fillOpacity={0.6} />
//         </RadarChart>
//       </div>

//       {/* Vehicle Type Pie Chart */}
//       <div className="chart-card">
//         <h3>Vehicle Type Distribution</h3>
//         <PieChart width={300} height={250}>
//           <Pie
//             data={vehicleTypePie}
//             dataKey="value"
//             nameKey="name"
//             cx="50%"
//             cy="50%"
//             outerRadius={80}
//             fill="#8884d8"
//             label
//           >
//             {vehicleTypePie.map((entry, index) => (
//               <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
//             ))}
//           </Pie>
//           <Tooltip />
//         </PieChart>
//       </div>

//       {/* Count vs Time */}
//       <div className="chart-card">
//         <h3>Count vs Time per Location</h3>
//         <LineChart width={300} height={250} data={countVsTime}>
//           <CartesianGrid strokeDasharray="3 3" />
//           <XAxis dataKey="time" />
//           <YAxis />
//           <Tooltip />
//           <Legend />
//           <Line type="monotone" dataKey="A" stroke="#8884d8" />
//           <Line type="monotone" dataKey="B" stroke="#82ca9d" />
//           <Line type="monotone" dataKey="C" stroke="#FF8042" />
//         </LineChart>
//       </div>

//       {/* Traffic Flow Efficiency */}
//       <div className="chart-card">
//         <h3>Traffic Flow Efficiency</h3>
//         <BarChart width={300} height={250} data={flowEfficiency}>
//           <CartesianGrid strokeDasharray="3 3" />
//           <XAxis dataKey="location" />
//           <YAxis />
//           <Tooltip />
//           <Legend />
//           <Bar dataKey="efficiency" fill="#00C49F" />
//         </BarChart>
//       </div>
//     </div>
//   );
// }

// export default Analytics;
