import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';

function buildPath2DFromSvgString(d) {
  return new Path2D(d);
}

function rasterizeWaterMask(regionWater, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff';
  regionWater.forEach((wf) => {
    const path2d = buildPath2DFromSvgString(wf.d);
    ctx.fill(path2d);
  });

  const imageData = ctx.getImageData(0, 0, width, height).data;
  const waterMask = new Uint8Array(width * height);

  for (let i = 0; i < waterMask.length; i++) {
    if (imageData[i * 4 + 3] > 0) {
      waterMask[i] = 1;
    }
  }
  return waterMask;
}

const RenderCity = ({
  regionElevationArray,
  regionMatrixWidth,
  regionMatrixHeight,
  regionWater,
  simulatedShapes = [],
  buildings,
  roads
}) => {
  const [elevationScale, setElevationScale] = useState(1);
  const [waterMask, setWaterMask] = useState(null);

  const zValues = [];
  for (let row = 0; row < regionMatrixHeight; row++) {
    const start = row * regionMatrixWidth;
    const end = start + regionMatrixWidth;
    zValues.push(regionElevationArray.slice(start, end));
  }

  useEffect(() => {
    if (!regionWater || regionWater.length === 0) {
      setWaterMask(null);
      return;
    }
    const mask = rasterizeWaterMask(regionWater, regionMatrixWidth, regionMatrixHeight);
    setWaterMask(mask);
  }, [regionWater, regionMatrixWidth, regionMatrixHeight]);

  const maxOriginalVal = Math.max(...regionElevationArray);
  const minOriginalVal = Math.min(...regionElevationArray);
  const maxScaledVal = maxOriginalVal * elevationScale;

  const scaledZValues = zValues.map((row) =>
    row.map((val) => val * elevationScale)
  );

  const specialWaterValue = minOriginalVal - 1;
  const colorValue2D = [];
  for (let row = 0; row < regionMatrixHeight; row++) {
    const rowArr = [];
    for (let col = 0; col < regionMatrixWidth; col++) {
      const idx = row * regionMatrixWidth + col;
      rowArr.push(waterMask && waterMask[idx] === 1 ? specialWaterValue : scaledZValues[row][col]);
    }
    colorValue2D.push(rowArr);
  }

  const fractionMinVal = (minOriginalVal * elevationScale - specialWaterValue) / (maxScaledVal - specialWaterValue);
  const customColorScale = [
    [0, 'rgb(64, 173, 216)'],
    [fractionMinVal, 'rgb(64, 173, 216)'],
    [fractionMinVal + 0.0001, 'rgb(200,255,200)'],
    [1, 'rgb(34,139,34)'],
  ];

  const shapeLineTraces = simulatedShapes
    .filter(shape => !(shape.id && shape.id.startsWith('obstacle-')))
    .map((shape, shapeIndex) => {
      const xCoords = [];
      const yCoords = [];
      const zCoords = [];
      const polygon = shape.outerPolygon;
      if (!polygon || polygon.length < 2) {
        return null;
      }

      for (let i = 0; i < polygon.length; i++) {
        const [x, y] = polygon[i];
        const xClamped = Math.min(Math.max(0, Math.floor(x)), regionMatrixWidth - 1);
        const yClamped = Math.min(Math.max(0, Math.floor(y)), regionMatrixHeight - 1);

        xCoords.push(xClamped);
        yCoords.push(yClamped);
        zCoords.push(scaledZValues[yClamped][xClamped] + 2); 
      }

      xCoords.push(xCoords[0]);
      yCoords.push(yCoords[0]);
      zCoords.push(zCoords[0]);

      return {
        type: 'scatter3d',
        mode: 'lines',
        x: xCoords,
        y: yCoords,
        z: zCoords,
        name: shape.id || `Shape ${shapeIndex}`,
        line: {
          color: 'grey',
          width: 6
        },
        showlegend: false // Hide legend for this trace
      };
    }).filter(Boolean);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ marginRight: '10px' }}>
          Elevation Scale: {elevationScale.toFixed(1)}
        </label>
        <input
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
      z: scaledZValues,
      type: 'surface',
      surfacecolor: colorValue2D,
      cmin: specialWaterValue,
      cmax: maxScaledVal,
      colorscale: customColorScale,
      showscale: false // Hide color scale (legend)
    },
    ...shapeLineTraces
  ]}
  layout={{
    title: 'City Elevation Surface (with Water + Shapes)',
    autosize: true,
    paper_bgcolor: '#E0F7FF',
    plot_bgcolor: '#E0F7FF',
    scene: {
      bgcolor: '#E0F7FF',
      aspectmode: 'manual',
      aspectratio: { x: 1, y: 1, z: 0.3 },
      xaxis: {
        title: '',
        showticklabels: false,
        showgrid: false,
        zeroline: false,
      },
      yaxis: {
        title: '',
        showticklabels: false,
        showgrid: false,
        zeroline: false,
      },
      zaxis: {
        title: '',
        showticklabels: false,
        showgrid: false,
        zeroline: false,
        range: [0, maxScaledVal * 1.2],
      },
    },
    margin: { l: 0, r: 0, t: 30, b: 0 },
    showlegend: false // Hide legend globally
  }}
  style={{ width: '100%', height: '600px' }}
  config={{ responsive: true }}
/>
    </div>
  );
};

export default RenderCity;
