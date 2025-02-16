import React, { useState } from 'react';
import Plot from 'react-plotly.js';

const RenderCity = ({ regionElevationArray, regionMatrixWidth, regionMatrixHeight }) => {
  // Convert the 1D regionElevationArray into a 2D array (matrix)
  const zValues = [];
  for (let row = 0; row < regionMatrixHeight; row++) {
    const startIndex = row * regionMatrixWidth;
    const endIndex = startIndex + regionMatrixWidth;
    zValues.push(regionElevationArray.slice(startIndex, endIndex));
  }

  // Generate x and y axis arrays
  const xValues = Array.from({ length: regionMatrixWidth }, (_, i) => i);
  const yValues = Array.from({ length: regionMatrixHeight }, (_, i) => i);

  // State to hold the elevation scale factor
  const [elevationScale, setElevationScale] = useState(1);

  // Scale the elevation values by elevationScale
  const scaledZValues = zValues.map(row => row.map(val => val * elevationScale));

  // Find the max elevation in the data (after scaling)
  const maxScaledVal = Math.max(...regionElevationArray) * elevationScale;

  // We'll leave a bit of extra space at the top so it doesn't fill the entire vertical range
  const zAxisMax = maxScaledVal * 1.2; // 20% buffer above the highest point

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {/* Slider to control elevation scale */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="elevationSlider" style={{ marginRight: '10px' }}>
          Elevation Scale: {elevationScale}
        </label>
        <input
          id="elevationSlider"
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={elevationScale}
          onChange={(e) => setElevationScale(Number(e.target.value))}
          style={{ width: '200px' }}
        />
      </div>

      <Plot
        data={[
          {
            x: xValues,
            y: yValues,
            z: scaledZValues,
            type: 'surface',
            // Use 'Greens' for a green color scheme
            colorscale: 'Greens',
          },
        ]}
        layout={{
          title: 'City Elevation Surface',
          autosize: true,
          scene: {
            // Use aspectratio to flatten the terrain so it doesn’t look too spiky
            aspectmode: 'manual',
            aspectratio: { x: 1, y: 1, z: 0.3 },
            xaxis: { title: 'X Axis' },
            yaxis: { title: 'Y Axis' },
            zaxis: {
              title: 'Elevation',
              range: [0, zAxisMax], // sets a vertical limit based on data
            },
          },
          margin: { l: 0, r: 0, t: 30, b: 0 }, // Adjust margins as needed
        }}
        style={{ width: '100%', height: '600px' }}
        config={{ responsive: true }}
      />
    </div>
  );
};

export default RenderCity;
