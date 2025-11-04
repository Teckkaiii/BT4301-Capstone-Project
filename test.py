/* New overall container for spacing */
.recommendations-container {
  padding: 20px;
}

/* Styling for each location group */
.location-group {
  margin-bottom: 40px; /* Space between different location sections */
}

.location-group h2 {
  color: #333; /* Darker color for section headings */
  border-bottom: 2px solid #ccc;
  padding-bottom: 5px;
  margin-bottom: 15px;
}

.rec-grid {
  display: grid;
  /* You can make this responsive if you like */
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
  gap: 20px; /* Increased gap for better separation */
  padding: 0; /* Remove padding as it's handled by recommendations-container */
}

.rec-card {
  background-color: white;
  border-radius: 10px;
  padding: 15px;
  box-shadow: 0px 4px 15px rgba(0,0,0,0.1); /* Slightly more prominent shadow */
  transition: transform 0.2s;
}

.rec-card:hover {
  transform: translateY(-3px); /* Subtle hover effect */
}

/* ===========================================
   Recommendations Grid and Card Styling
   =========================================== */
.rec-grid {
    display: grid;
    /* Use repeat(auto-fit, minmax(280px, 1fr)) for better responsiveness */
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
    gap: 15px;
    padding: 10px;
}

.location-group h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin-top: 25px;
    margin-bottom: 10px;
}

.rec-card {
    background-color: white;
    border-radius: 10px;
    padding: 15px;
    box-shadow: 0px 2px 10px rgba(0,0,0,0.1);
    display: flex; 
    flex-direction: column;
    justify-content: space-between; 
    min-height: 180px; 
    position: relative;
    overflow: hidden; /* important for the tag to stay contained */
    border: 1px solid #e5e7eb; /* Default light border */
}

/* -------------------
   1. Priority Tag Styling
   ------------------- */
.priority-tag {
    /* Styles for the colored box at the top */
    display: inline-block;
    padding: 3px 8px;
    font-size: 0.7rem;
    font-weight: 700;
    border-radius: 5px;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px; /* Space below the tag */
}

/* High Priority (Red) */
.priority-high {
    background-color: #ef4444; /* Red */
    /* Add a subtle red border for the entire card for HIGH priority */
    border-left: 5px solid #ef4444; 
}
.rec-card.priority-high {
    border-left: 5px solid #ef4444;
}

/* Medium Priority (Amber) */
.priority-medium {
    background-color: #f59e0b; /* Amber */
}
.rec-card.priority-medium {
    border-left: 5px solid #f59e0b;
}

/* Low Priority (Green) */
.priority-low {
    background-color: #10b981; /* Green */
}
.rec-card.priority-low {
    border-left: 5px solid #10b981;
}

/* -------------------
   2. Title and Description
   ------------------- */
.rec-card h3 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #111827;
    margin-top: 5px;
    margin-bottom: 8px;
}

.rec-card p {
    font-size: 0.9rem;
    color: #4b5563;
    margin-bottom: 10px;
    flex-grow: 1; /* Allows description to take up available space */
}

/* -------------------
   3. Volume Count Line (Last Line)
   ------------------- */
.volume-count-line {
    font-size: 1rem;
    font-weight: 700;
    margin-top: 10px;
}

.volume-high {
    color: #ef4444; /* Red */
}

.volume-medium {
    color: #f59e0b; /* Amber */
}

.volume-low {
    color: #10b981; /* Green */
}
