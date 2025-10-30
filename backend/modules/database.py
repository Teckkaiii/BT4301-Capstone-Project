import os
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime

# ======================================
# MongoDB Initialization
# ======================================

db = None
counts_collection = None

def init_db():
    global db, counts_collection
    load_dotenv(dotenv_path=".env")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/vehicle_db")

    client = MongoClient(MONGO_URI)
    db = client["vehicle_db"]
    counts_collection = db["vehicle_counts"]

    print("[DB] Connected to MongoDB successfully.")

def save_counts_to_mongo(counts_dict, location):
    payload = {
        "timestamp": datetime.utcnow(),
        "location": location,
        "counts": counts_dict
    }
    counts_collection.insert_one(payload)
    print(f"[{datetime.utcnow()}] Counts saved for {location}: {counts_dict}")
