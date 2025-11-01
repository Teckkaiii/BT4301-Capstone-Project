import React, { useState } from "react";
import { detectVehicle } from "../services/api";
import DetectionResult from "./DetectionResult";

function CameraFeed() {
  const [image, setImage] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setLoading(true);
    const data = await detectVehicle(file);
    setLoading(false);

    if (data && data.results) setResults(data.results);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Upload Image for Vehicle Detection</h2>
      <input type="file" accept="image/*" onChange={handleUpload} />
      {loading && <p>Processing image...</p>}
      {image && <img src={image} alt="uploaded" width={400} />}
      <DetectionResult results={results} />
    </div>
  );
}

export default CameraFeed;
