import React, { useState, useEffect } from "react";
import "./Recommendations.css";

const API_BASE = "http://localhost:5001"; 
// 1. Hourly Volume (Bulk)
const HOURLY_VOLUME_ENDPOINT = `${API_BASE}/api/last_hour_volume`; 
// 2. Congestion (Per location)
const CONGESTION_ENDPOINT = `${API_BASE}/congestion/`; 
// 3. Current Counts (Per location - used for Vehicle Mix)
const CURRENT_COUNTS_ENDPOINT = `${API_BASE}/current_counts/`; 
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
        ? 'Traffic volume is approaching critical capacity. Initiate a **strategic review of capital projects and perform a detailed network capacity study.' // 🟢 NEW DESCRIPTION FOR MEDIUM
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
        
        const isActive = priority !== 'LOW';

        // --- UPDATED LOGIC TO HANDLE ALL THREE PRIORITY LEVELS ---
        const title = 
            priority === 'HIGH' ? "Immediate Signal Intervention" :
            priority === 'MEDIUM' ? "Tactical Signal Review" : // 🟢 NEW TITLE FOR MEDIUM
            "Normal Congestion Level";

        const description = isActive 
            ? priority === 'HIGH'
                ? 'Critically high density detected. **Immediately increase green light duration** and review adjacent intersection coordination.'
                : 'Vehicle density is rising. Adjust traffic light cycles for the next 15 minutes to preemptively relieve congestion build-up.' // 🟢 NEW DESCRIPTION FOR MEDIUM
            : 'Congestion is currently low. No immediate signal timing action required.';
        // --------------------------------------------------------

        return { 
            priority: isActive ? priority : 'LOW', classColor: isActive ? classColor : 'low', isActive: isActive,
            title: title,
            description: description,
            metricLabel: '5-min Congestion',
            metricValue: `${count.toFixed(1)} Avg Vehicles/5min`
        }; 
    };

    // 3. Current Counts (Vehicle Mix/Policy)
    const getVehicleMixCategory = (counts) => {
        // Trigger if total heavy vehicles (truck + bus) exceeds a threshold
        const totalHeavy = (counts.truck ?? 0) + (counts.bus ?? 0);
        
        let priority, classColor;
        if (totalHeavy > 50) {
            priority = 'HIGH'; classColor = 'high';
        } else if (totalHeavy > 20) {
            priority = 'MEDIUM'; classColor = 'medium';
        } else {
            priority = 'LOW'; classColor = 'low';
        }

        const isActive = priority !== 'LOW';
        return {
            priority: isActive ? priority : 'LOW', classColor: isActive ? classColor : 'low', isActive: isActive,
            title: 'Vehicle Type Management',
            description: isActive
                ? 'High volume of trucks/buses detected. Consider implementing temporal restrictions or dedicated freight lanes.'
                : 'Vehicle mix is balanced. No immediate action on heavy vehicles needed.',
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
            priority === 'HIGH' ? "Systemic Flow Failure" :             // HIGH: Critical title for very low efficiency
            priority === 'MEDIUM' ? "Network Optimization Review" :          // 🟢 REFINED MEDIUM TITLE
            "Efficiency: On Target";                                        // 🟢 REFINED LOW TITLE

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
            metricLabel: 'Flow Efficiency Score',
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

            // 1 & 4. Bulk fetches
            const [volumeRes, efficiencyRes] = await Promise.all([
                fetch(HOURLY_VOLUME_ENDPOINT).catch(e => console.error("Volume fetch error:", e)),
                fetch(FLOW_EFFICIENCY_ENDPOINT).catch(e => console.error("Efficiency fetch error:", e))
            ]);

            // Process Hourly Volume
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

            // Process Flow Efficiency
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


            // 2 & 3. Per-Location fetches (Congestion & Current Counts)
            const fetchLocationData = async () => {
                const congResults = {};
                const countResults = {};
                
                const promises = activeLocationKeys.map(async key => {
                    const [congRes, countRes] = await Promise.all([
                        fetch(`${CONGESTION_ENDPOINT}${encodeURIComponent(key)}`),
                        fetch(`${CURRENT_COUNTS_ENDPOINT}${encodeURIComponent(key)}`)
                    ]);
                    
                    if (congRes.ok) {
                        const data = await congRes.json();
                        congResults[key] = { average_vehicles: data.average_vehicles ?? 0 };
                    } else { congResults[key] = { average_vehicles: 0 }; }

                    if (countRes.ok) {
                        const data = await countRes.json();
                        // Assume counts are nested under a 'counts' key
                        countResults[key] = data.counts ?? {};
                    } else { countResults[key] = {}; }
                });

                await Promise.all(promises);
                if (!cancel) {
                    setCongestionData(congResults);
                    setCurrentCounts(countResults);
                }
            };

            await fetchLocationData();
            if (!cancel) setLoading(false);
        };

        fetchData();
        const intervalId = setInterval(fetchData, 60000); // Poll every minute

        return () => { 
            cancel = true; 
            clearInterval(intervalId); 
        }; 
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

        // 2. Congestion Card (Active only if Medium/High)
        if (congestion.isActive) {
            cards.push({
                id: `${key}-congestion`,
                type: 'congestion',
                ...congestion
            });
        }

        // 3. Vehicle Mix Card (Active only if Medium/High)
        if (vehicleMix.isActive) {
            cards.push({
                id: `${key}-vehiclemix`,
                type: 'vehiclemix',
                ...vehicleMix
            });
        }

        // 4. Flow Efficiency Card (Active only if Low/Medium score)
        if (efficiency.isActive) {
            cards.push({
                id: `${key}-efficiency`,
                type: 'efficiency',
                ...efficiency
            });
        }
        
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