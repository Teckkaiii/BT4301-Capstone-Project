import React, { useState, useEffect } from "react";
import "./Recommendations.css";

const API_BASE = "http://localhost:5001"; 
// 1. Hourly Volume (Bulk)
const HOURLY_VOLUME_ENDPOINT = `${API_BASE}/api/last_hour_volume`; 
// 2. Congestion (Per location)
const CONGESTION_ENDPOINT = `${API_BASE}/api/congestion_by_location`;
// 3. Current Counts (Per location - used for Vehicle Mix)
const HEAVY_VEHICLE_ENDPOINT = `${API_BASE}/api/heavy_vehicle_counts`;
// 4. Flow Efficiency (Bulk)
const FLOW_EFFICIENCY_ENDPOINT = `${API_BASE}/api/flow_efficiency`; 

// Define the locations we are tracking
const ALL_LOCATIONS = [ 
    { location: "Location 1", key: "location1" }, 
    { location: "Location 2", key: "location2" }, 
    { location: "Location 3", key: "location3" }, 
]; 

function Recommendations({ activeLocationKeys = ["location1", "location2", "location3"] }) { 
    // State for all four metrics
    const [hourlyTotals, setHourlyTotals] = useState({}); 
    const [congestionData, setCongestionData] = useState({});
    const [currentCounts, setCurrentCounts] = useState({});
    const [flowEfficiency, setFlowEfficiency] = useState({});
    const [loading, setLoading] = useState(true); 

    // =========================================== 
    // HELPER FUNCTIONS: CATEGORIZATION
    // =========================================== 
    
    // 1. Throughput (Infrastructure/Long-Term)
    const getThroughputCategory = (count) => { 
        let priority, classColor; 
        if (count > 1000) { 
            priority = 'HIGH'; classColor = 'high'; 
        } else if (count >= 701) { 
            priority = 'MEDIUM'; classColor = 'medium'; 
        } else { 
            priority = 'LOW'; classColor = 'low'; 
        } 
        
        // This metric should always be shown, so isActive is always true
        const isActive = true;

        // --- UPDATED LOGIC TO HANDLE ALL THREE PRIORITY LEVELS ---
        const title = 
            priority === 'HIGH' ? "Infrastructure Expansion Project" :
            priority === 'MEDIUM' ? "Strategic Capacity Review" : // 🟢 NEW TITLE FOR MEDIUM
            "Normal Throughput Status";

        const description =
            priority === 'HIGH' 
            ? 'Severe vehicle throughput detected. Consider long-term infrastructure improvements such as additional lanes or intersection redesign.' 
            : priority === 'MEDIUM' 
            ? 'Traffic volume is approaching critical capacity. Initiate a strategic review of capital projects and perform a detailed network capacity study.' // 🟢 NEW DESCRIPTION FOR MEDIUM
            : 'Vehicle throughput within acceptable range. Continue monitoring current strategies.';
        // --------------------------------------------------------

        return { 
            priority: priority, classColor: classColor, isActive: isActive,
            title: title,
            description: description,
            metricLabel: 'Hourly Throughout',
            metricValue: `${count.toLocaleString()} Vehicles/hour`
        }; 
    };
    
    // 2. Congestion (Signal Timing/Short-Term)
    const getCongestionCategory = (count) => { 
        let priority, classColor; 
        if (count > 50) { 
            priority = 'HIGH'; classColor = 'high'; 
        } else if (count > 20) { 
            priority = 'MEDIUM'; classColor = 'medium'; 
        } else { 
            priority = 'LOW'; classColor = 'low'; 
        } 
        
        const isActive = true

        // --- UPDATED LOGIC TO HANDLE ALL THREE PRIORITY LEVELS ---
        const title = 
            priority === 'HIGH' ? "Immediate Signal Intervention" :
            priority === 'MEDIUM' ? "Tactical Signal Review" : // 🟢 NEW TITLE FOR MEDIUM
            "Normal Congestion Level";

        const description =
            priority === 'HIGH'
            ? 'Critically high density detected. Immediately increase green light duration and review adjacent intersection coordination.'
            : priority === 'MEDIUM'
            ? 'Vehicle density is rising. Adjust traffic light cycles for the next 15 minutes to preemptively relieve congestion build-up.' // 🟢 NEW DESCRIPTION FOR MEDIUM
            : 'Congestion is currently low. No immediate signal timing action required.';
        // --------------------------------------------------------

        return { 
            priority: priority, classColor: classColor, isActive: isActive,
            title: title,
            description: description,
            metricLabel: '5-min Congestion',
            metricValue: `${count.toFixed(1)} Avg Vehicles/day`
        }; 
    };

    // 3. Current Counts (Vehicle Mix/Policy)
    const getVehicleMixCategory = (counts) => {
        // Calculate total heavy vehicles (truck + bus)
        const totalHeavy = (counts.truck ?? 0) + (counts.bus ?? 0);
        
        let priority, classColor, title, description;

        if (totalHeavy > 20) {
            priority = 'HIGH';
            classColor = 'high';
            title = 'Heavy Vehicle Congestion Risk';
            description = 'High volume of trucks and buses detected. Consider imposing timing restrictions for heavy vehicles or designating special lanes.';
        } else if (totalHeavy > 10) {
            priority = 'MEDIUM';
            classColor = 'medium';
            title = 'Moderate Heavy Vehicle Activity';
            description = 'Moderate truck/bus presence observed. Monitor traffic conditions and prepare mitigation plans if volumes increase.';
        } else {
            priority = 'LOW';
            classColor = 'low';
            title = 'Balanced Vehicle Mix';
            description = 'Heavy vehicle levels are within acceptable limits. No immediate action required at this time.';
        }

        return {
            priority,
            classColor,
            title,
            description,
            metricLabel: 'Current Heavy Mix',
            metricValue: `${totalHeavy} Heavy Vehicles`
        };
    };


    // 4. Flow Efficiency (Systemic Health)
    const getEfficiencyCategory = (score) => {
        // Score is 0.0 (Worst) to 1.0 (Best). Low score = High priority to fix.
        let priority, classColor;
        if (score < 0.3) {
            priority = 'HIGH'; classColor = 'high';
        } else if (score < 0.6) {
            priority = 'MEDIUM'; classColor = 'medium';
        } else {
            priority = 'LOW'; classColor = 'low';
        }

        const isActive = priority !== 'LOW';

        // --- REVISED TITLES AND DESCRIPTIONS ---
        const title = 
            priority === 'HIGH' ? "Systemic Flow Failure" :    
            priority === 'MEDIUM' ? "Network Optimization Review" :        
            "Efficiency: On Target";                                     

        const description = isActive
            ? priority === 'HIGH'
                ? 'Current traffic flow is critically inefficient. Immediately initiate a full network diagnostic to identify core causes of breakdown.'
                : 'Efficiency score is below target. Review signal coordination across the wider network and assess origin-destination patterns.' // 🟢 REFINED MEDIUM DESCRIPTION
            : 'Flow efficiency is good. Maintain current operational protocols.';
        // ----------------------------------------

        return {
            priority: isActive ? priority : 'LOW', classColor: isActive ? classColor : 'low', isActive: isActive,
            title: title,
            description: description,
            metricLabel: '30-min Flow Efficiency Score',
            metricValue: `${(score * 100).toFixed(1)}% Efficient`
        };
    };


    // ===========================================
    // QUAD DATA FETCHING LOGIC
    // ===========================================
    useEffect(() => {
        let cancel = false; 
    
        const fetchData = async () => { 
            setLoading(true); 
    
            // 1, 2 & 4. Bulk fetches (Hourly Volume, Congestion, Flow Efficiency)
            const [volumeRes, congestionRes, efficiencyRes, heavyRes] = await Promise.all([
                fetch(HOURLY_VOLUME_ENDPOINT).catch(e => console.error("Volume fetch error:", e)),
                fetch(CONGESTION_ENDPOINT).catch(e => console.error("Congestion fetch error:", e)),
                fetch(FLOW_EFFICIENCY_ENDPOINT).catch(e => console.error("Efficiency fetch error:", e)),
                fetch(HEAVY_VEHICLE_ENDPOINT).catch(e => console.error("Heavy vehicle fetch error:", e))
            ]);
    
            // --- Process Hourly Volume ---
            try {
                if (volumeRes && volumeRes.ok) {
                    const volumeData = await volumeRes.json(); 
                    const lastHourCounts = volumeData.length > 0 ? volumeData[0] : {}; 
                    const currentVolumeMap = {}; 
                    for (const key in lastHourCounts) { 
                        if (key !== 'time') currentVolumeMap[key] = lastHourCounts[key]; 
                    } 
                    if (!cancel) setHourlyTotals(currentVolumeMap); 
                } else { if (!cancel) setHourlyTotals({}); }
            } catch (e) { console.error("Error processing hourly volume:", e); }
    
            // --- Process Congestion (All Locations at Once) ---
            try {
                if (congestionRes && congestionRes.ok) {
                    const congData = await congestionRes.json();
                    const congMap = congData.reduce((acc, item) => {
                        const locKey = item.location.toLowerCase().replace(/\s+/g, '');
                        acc[locKey] = { average_vehicles: item.congestion ?? 0 };
                        return acc;
                    }, {});
                    if (!cancel) setCongestionData(congMap);
                } else { if (!cancel) setCongestionData({}); }
            } catch (e) { console.error("Error processing congestion:", e); }
    
            // --- Process Flow Efficiency ---
            try {
                if (efficiencyRes && efficiencyRes.ok) {
                    const effData = await efficiencyRes.json();
                    const effMap = effData.reduce((acc, item) => {
                        acc[item.location] = item.efficiency ?? 1.0;
                        return acc;
                    }, {});
                    if (!cancel) setFlowEfficiency(effMap);
                } else { if (!cancel) setFlowEfficiency({}); }
            } catch (e) { console.error("Error processing flow efficiency:", e); }
    
            // --- Process Heavy Vehicle Counts (Bulk) ---
            try {
                if (heavyRes && heavyRes.ok) {
                    const heavyData = await heavyRes.json();
                    const heavyMap = heavyData.reduce((acc, item) => {
                        const locKey = item.location.toLowerCase().replace(/\s+/g, '');
                        acc[locKey] = {
                            truck: item.truck ?? 0,
                            bus: item.bus ?? 0,
                            total_heavy: item.total_heavy ?? (item.truck ?? 0) + (item.bus ?? 0)
                        };
                        return acc;
                    }, {});
                    if (!cancel) setCurrentCounts(heavyMap);
                } else if (!cancel) setCurrentCounts({});
            } catch (e) {
                console.error("Error processing heavy vehicle counts:", e);
            }
    
            if (!cancel) setLoading(false);
        };
    
        fetchData();
        const intervalId = setInterval(fetchData, 60000); // refresh every 1 min
    
        return () => { cancel = true; clearInterval(intervalId); };
    }, [activeLocationKeys]);
    
    // ===========================================
    // DATA AGGREGATION AND CARD GENERATION
    // ===========================================
    const finalCardsByLocation = ALL_LOCATIONS.reduce((acc, loc) => { 
        const key = loc.key;
        if (!activeLocationKeys.includes(key)) return acc;

        // Fetch data for the four metrics (default to safe values)
        const hourlyCount = hourlyTotals[key] ?? 0;
        const avgVehicles = congestionData[key]?.average_vehicles ?? 0;
        const counts = currentCounts[key] ?? {};
        const efficiencyScore = flowEfficiency[key] ?? 1.0;

        // Skip if data is not loaded yet (prevents flashing empty cards)
        if (loading && hourlyCount === 0 && avgVehicles === 0) return acc;

        // Generate categorization for all four metrics
        const throughput = getThroughputCategory(hourlyCount);
        const congestion = getCongestionCategory(avgVehicles);
        const vehicleMix = getVehicleMixCategory(counts);
        const efficiency = getEfficiencyCategory(efficiencyScore);

        let cards = [];

        // 1. Throughput Card (Always shown)
        cards.push({
            id: `${key}-throughput`,
            type: 'throughput',
            ...throughput
        });

        // 2. Congestion Card (Always shown)
        cards.push({
            id: `${key}-congestion`,
            type: 'congestion',
            ...congestion
        });

        // 3. Vehicle Mix Card (Always shown)
        cards.push({
            id: `${key}-vehiclemix`,
            type: 'vehiclemix',
            ...vehicleMix
        });

        // 4. Flow Efficiency Card (Always shown)
        cards.push({
            id: `${key}-efficiency`,
            type: 'efficiency',
            ...efficiency
        });
        
        if (cards.length > 0) {
            // Add location details to each card for rendering
            const cardsWithLocation = cards.map(card => ({...card, locationName: loc.location}));
            acc[loc.location] = cardsWithLocation; 
        }

        return acc; 
    }, {}); 

    // --- Rendering Logic --- 
    return ( 
        <div className="recommendations-container"> 
            {loading && Object.keys(hourlyTotals).length === 0 &&
                <p className="text-center p-4">Loading real-time traffic analysis...</p>
            } 
            {Object.keys(finalCardsByLocation).length === 0 && !loading ? ( 
                <p className="text-center p-4">No critical recommendations currently detected for active locations.</p> 
            ) : ( 
                Object.keys(finalCardsByLocation).map(locationName => ( 
                    <div key={locationName} className="location-group"> 
                        <h2 className="location-header">{locationName}</h2>
                        <div className="rec-grid"> 
                            {/* Renders all generated card objects (1 to 4) as separate rec-card containers */}
                            {finalCardsByLocation[locationName].map(r => ( 
                                <div 
                                    key={r.id} 
                                    className={`rec-card card-type-${r.type}`} 
                                > 
                                    {/* 1. PRIORITY TAG */} 
                                    <div className="priority-tag-wrapper"> 
                                        <div className={`priority-tag priority-${r.classColor}`}> 
                                            {r.priority} PRIORITY 
                                        </div> 
                                    </div> 

                                    {/* 2. TITLE */} 
                                    <h3>{r.title}</h3> 
                                    {/* 3. DESCRIPTION */} 
                                    <p>{r.description}</p> 
                                    
                                    {/* 4. METRIC DISPLAY */}
                                    <div className="single-metric-container">
                                        <span className="metric-label">{r.metricLabel}</span>
                                        <div className={`metric-value volume-${r.classColor}`}> 
                                            {r.metricValue} 
                                        </div>
                                    </div>
                                </div> 
                            ))} 
                        </div> 
                    </div> 
                )) 
            )} 
        </div> 
    ); 
} 

export default Recommendations;