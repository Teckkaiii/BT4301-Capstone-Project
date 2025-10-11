import React from "react";

function DetectionResult({ results }) {
  if (!results || results.length === 0) return null;

  return (
    <div>
      <h3>Detection Results:</h3>
      <ul>
        {results.map((r, idx) => (
          <li key={idx}>
            {r.label}: {(r.confidence * 100).toFixed(1)}%
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DetectionResult;
