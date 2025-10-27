from datetime import datetime, timedelta
from .database import counts_collection

def get_congestion_level(location, interval_minutes=5):
    now = datetime.utcnow()
    past_time = now - timedelta(minutes=interval_minutes)

    recent_counts = list(counts_collection.find({
        "timestamp": {"$gte": past_time},
        "location": location
    }))

    if not recent_counts:
        return {"location": location, "level": "Low", "average_vehicles": 0}

    total_vehicles = sum(sum(doc["counts"].values()) for doc in recent_counts)
    avg_vehicles = total_vehicles / len(recent_counts)

    if avg_vehicles > 50:
        level = "High"
    elif avg_vehicles > 20:
        level = "Medium"
    else:
        level = "Low"

    return {"location": location, "level": level, "average_vehicles": avg_vehicles}
