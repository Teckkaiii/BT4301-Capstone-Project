from datetime import datetime, timedelta
from .database import counts_collection
from pymongo import ASCENDING, DESCENDING
import pytz # Import pytz for timezone handling

# Define a common timezone, e.g., Singapore Time
# This ensures "today" is calculated correctly
# You can change 'Asia/Singapore' to your server's local timezone
TIMEZONE = pytz.timezone("Asia/Singapore") 

def get_today_range():
    """Returns the start and end datetime for 'today' in the defined timezone."""
    now = datetime.now(TIMEZONE)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    
    # Convert back to UTC for MongoDB queries, as timestamps are stored in UTC
    return start_of_day.astimezone(pytz.utc), end_of_day.astimezone(pytz.utc)

def get_time_range(hours_ago=8):
    """Returns the start and end datetime for the last N hours."""
    now_utc = datetime.utcnow()
    start_time = now_utc - timedelta(hours=hours_ago)
    return start_time, now_utc

# --- New Analytics Functions ---

def get_traffic_volume_trends(hours=8):
    """
    (Chart 1)
    Aggregates total vehicles and "congestion" (avg vehicles per entry) 
    grouped by hour for the last N hours.
    """
    start_time, end_time = get_time_range(hours_ago=hours)
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_time, "$lt": end_time}}},
        {
            "$project": {
                "timestamp": 1,
                # Project the 'Total' count, default to 0 if not present
                "total_count": {"$ifNull": ["$counts.Total", 0]}
            }
        },
        {
            "$group": {
                # Group by the hour, in UTC
                "_id": {"$hour": "$timestamp"}, 
                "vehicles": {"$sum": "$total_count"},
                "congestion": {"$avg": "$total_count"} # Avg vehicles per 1-min entry
            }
        },
        {"$sort": {"_id": ASCENDING}},
        # Format the output to match the chart
        {"$project": {"_id": 0, "time": "$_id", "vehicles": 1, "congestion": 1}}
    ]
    return list(counts_collection.aggregate(pipeline))

def get_hourly_counts_per_location(hours=8):
    """
    (Chart 5)
    Aggregates total vehicles per location, pivoted by hour, for the last N hours.
    This format is exactly what the 'Count vs Time' chart needs.
    """
    start_time, end_time = get_time_range(hours_ago=hours)
    
    # Get the location names from the VIDEO_MAP in yolo_processing
    # In a real app, this might come from a config or the DB
    # For this project, we know them
    locations = ["location1", "location2", "location3"]
    
    # Build the dynamic $group stage
    group_stage = {
        "_id": {"$hour": "$timestamp"},
        "time": {"$first": {"$hour": "$timestamp"}}
    }
    
    # Dynamically add a sum for each location
    for loc in locations:
        group_stage[loc] = {
            "$sum": {
                "$cond": [
                    {"$eq": ["$location", loc]},
                    {"$ifNull": ["$counts.Total", 0]}, # Use Total count
                    0
                ]
            }
        }

    pipeline = [
        {"$match": {"timestamp": {"$gte": start_time, "$lt": end_time}}},
        {"$group": group_stage},
        {"$sort": {"time": ASCENDING}},
        {"$project": {"_id": 0}} # Clean up the output
    ]
    
    # Rename location1 -> A, location2 -> B, etc. for the chart
    results = list(counts_collection.aggregate(pipeline))
    
    # Map 'location1' to 'A', 'location2' to 'B' etc.
    # This is needed because the chart dataKey is "A", "B", "C"
    mapping = {"location1": "A", "location2": "B", "location3": "C"}
    final_results = []
    for row in results:
        new_row = {"time": row["time"]}
        for py_loc, chart_loc in mapping.items():
            new_row[chart_loc] = row.get(py_loc, 0)
        final_results.append(new_row)
        
    return final_results

def get_all_locations_congestion(interval_minutes=5):
    """
    (Chart 2)
    Gets the average vehicle count (congestion) for ALL locations
    in the last N minutes. This is a single, efficient query.
    """
    start_time, end_time = get_time_range(hours_ago=(interval_minutes / 60))
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_time, "$lt": end_time}}},
        {
            "$group": {
                "_id": "$location",
                # Use 'Total' as the metric for congestion
                "congestion": {"$avg": {"$ifNull": ["$counts.Total", 0]}}
            }
        },
        # Format the output to match the chart
        {"$project": {"_id": 0, "location": "$_id", "congestion": 1}}
    ]
    return list(counts_collection.aggregate(pipeline))

def get_vehicle_type_distribution(today=True):
    """
    (Chart 4)
    Gets the sum of all vehicle types detected for a time range (e.g., today).
    Uses objectToArray to dynamically handle all vehicle classes.
    """
    if today:
        start_time, end_time = get_today_range()
    else:
        # Or, get all-time data
        start_time = datetime.min.replace(tzinfo=pytz.utc)
        end_time = datetime.utcnow()

    pipeline = [
        {"$match": {"timestamp": {"$gte": start_time, "$lt": end_time}}},
        # Convert the 'counts' object to an array of [k, v] pairs
        {"$project": {"counts_kvp": {"$objectToArray": "$counts"}}},
        # Unwind the array to create a doc for each vehicle type
        {"$unwind": "$counts_kvp"},
        # Group by the vehicle type (k) and sum its counts (v)
        {
            "$group": {
                "_id": "$counts_kvp.k",
                "value": {"$sum": "$counts_kvp.v"}
            }
        },
        # Filter out "Total" from the pie chart
        {"$match": {"_id": {"$ne": "Total"}}},
        # Format for the chart
        {"$project": {"_id": 0, "name": "$_id", "value": 1}}
    ]
    return list(counts_collection.aggregate(pipeline))

def get_peak_hour_analysis(today=True):
    """
    (Chart 3)
    A 2-stage query:
    1. Finds the busiest hour of the day.
    2. Gets the vehicle breakdown for that specific hour.
    """
    if today:
        start_time, end_time = get_today_range()
    else:
        start_time, end_time = get_time_range(hours_ago=24) # Default to last 24h

    # --- Stage 1: Find the peak hour ---
    peak_hour_pipeline = [
        {"$match": {"timestamp": {"$gte": start_time, "$lt": end_time}}},
        {
            "$group": {
                "_id": {"$hour": "$timestamp"},
                "totalVehicles": {"$sum": {"$ifNull": ["$counts.Total", 0]}}
            }
        },
        {"$sort": {"totalVehicles": DESCENDING}},
        {"$limit": 1}
    ]
    
    peak_hour_result = list(counts_collection.aggregate(peak_hour_pipeline))
    if not peak_hour_result:
        return [] # No data for today
        
    peak_hour = peak_hour_result[0]['_id']

    # --- Stage 2: Get vehicle breakdown for that hour ---
    analysis_pipeline = [
        {
            "$match": {
                "timestamp": {"$gte": start_time, "$lt": end_time},
                # Add a calculated 'hour' field and match against it
                "$expr": {"$eq": [{"$hour": "$timestamp"}, peak_hour]}
            }
        },
        {"$project": {"counts_kvp": {"$objectToArray": "$counts"}}},
        {"$unwind": "$counts_kvp"},
        {
            "$group": {
                "_id": "$counts_kvp.k",
                "count": {"$sum": "$counts_kvp.v"}
            }
        },
        {"$match": {"_id": {"$ne": "Total"}}},
        # Format for the RadarChart
        {"$project": {"_id": 0, "vehicle": "$_id", "count": 1}}
    ]
    
    return list(counts_collection.aggregate(analysis_pipeline))

def get_flow_efficiency(interval_minutes=30):
    """
    (Chart 6)
    Calculates a proxy for "efficiency".
    We define it as: 1 - (location_avg / max_avg_of_all_locations)
    A location with 0 congestion is 1.0 (100%) efficient.
    The most congested location is 0.0 (0%) efficient.
    """
    # Get congestion data for all locations
    congestion_data = get_all_locations_congestion(interval_minutes)
    
    if not congestion_data:
        return []

    # Find the max congestion
    max_congestion = max(item['congestion'] for item in congestion_data)
    
    if max_congestion == 0:
        # Avoid division by zero; all are 100% efficient
        return [{"location": item['location'], "efficiency": 1.0} for item in congestion_data]

    # Calculate efficiency for each
    efficiency_data = []
    for item in congestion_data:
        eff = 1.0 - (item['congestion'] / max_congestion)
        efficiency_data.append({
            "location": item['location'],
            "efficiency": round(eff, 2) # Round to 2 decimal places
        })
        
    return efficiency_data