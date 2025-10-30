from datetime import datetime, timedelta
from . import database


from datetime import datetime, timedelta
from . import database  # import the whole module, not the variable

def get_congestion_level(location, interval_minutes=5):
    # Ensure DB initialized
    if database.counts_collection is None:
        raise RuntimeError("[DB] counts_collection not initialized. Did you call init_db()?")

    now = datetime.utcnow()
    past_time = now - timedelta(minutes=interval_minutes)

    # Access through the module (not a local name)
    recent_counts = list(database.counts_collection.find({
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
