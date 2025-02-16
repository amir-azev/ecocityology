import React from 'react';
import Plot from 'react-plotly.js';

const RenderCity = ({ regionElevationArray, regionMatrixWidth, regionMatrixHeight }) => {
  // Convert the 1D regionElevationArray into a 2D array (matrix)
  const zValues = [];
  for (let row = 0; row < regionMatrixHeight; row++) {
    const startIndex = row * regionMatrixWidth;
    const endIndex = startIndex + regionMatrixWidth;
    zValues.push(regionElevationArray.slice(startIndex, endIndex));
  }

  // Optional: Define the x and y coordinates
  // For instance, x could be [0..(regionMatrixWidth - 1)] and y [0..(regionMatrixHeight - 1)].
  const xValues = Array.from({ length: regionMatrixWidth }, (_, i) => i);
  const yValues = Array.from({ length: regionMatrixHeight }, (_, i) => i);

  return (
    <Plot
      data={[
        {
          x: xValues,
          y: yValues,
          z: zValues,
          type: 'surface',
          colorscale: 'Viridis',
        },
      ]}
      layout={{
        title: 'City Elevation Surface',
        autosize: true,
        scene: {
          xaxis: { title: 'X Axis' },
          yaxis: { title: 'Y Axis' },
          zaxis: { title: 'Elevation' },
        },
      }}
      style={{ width: '100%', height: '100%' }}
      config={{ responsive: true }}
    />
  );
};

export default RenderCity;
