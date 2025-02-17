import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";

function buildPath2DFromSvgString(d) {
  return new Path2D(d);
}

function rasterizeWaterMask(regionWater, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fff";
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

// Clamps a value between 0 and maxVal
function clamp(val, maxVal) {
  return Math.min(Math.max(0, val), maxVal);
}

// Cuboid face indices for mesh3d (defines 12 triangles for a cuboid)
const CUBOID_I = [0, 0, 4, 4, 0, 0, 1, 1, 2, 2, 3, 3];
const CUBOID_J = [1, 2, 5, 6, 1, 5, 2, 6, 3, 7, 0, 4];
const CUBOID_K = [2, 3, 6, 7, 5, 4, 6, 5, 7, 6, 4, 7];

// Create a cuboid (mesh3d) for a single building using dark, earthy tones
function createBuildingMesh3D(building, scaledZValues, regionWidth, regionHeight) {
  // Dark, earthy color palette
  const colorOptions = ["#D2B48C", "#DEB887", "#A89F91", "#C0C0C0", "#B0A999", "#8C7B75"];

  const meshColor = colorOptions[Math.floor(Math.random() * colorOptions.length)];

  const corners2D = building.corners;
  if (!corners2D || corners2D.length < 4) {
    return null;
  }

  const xVals = new Array(8);
  const yVals = new Array(8);
  const zVals = new Array(8);

  // Build vertices for the bottom (indices 0..3) and top (indices 4..7) faces.
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = corners2D[i];
    const xClamped = clamp(Math.floor(cx), regionWidth - 1);
    const yClamped = clamp(Math.floor(cy), regionHeight - 1);
    const baseZ = scaledZValues[yClamped][xClamped];

    // Bottom face vertex
    xVals[i] = xClamped;
    yVals[i] = yClamped;
    zVals[i] = baseZ;

    // Top face vertex (offset by building height)
    xVals[i + 4] = xClamped;
    yVals[i + 4] = yClamped;
    zVals[i + 4] = baseZ + building.buildingHeight;
  }

  return {
    type: "mesh3d",
    x: xVals,
    y: yVals,
    z: zVals,
    i: CUBOID_I,
    j: CUBOID_J,
    k: CUBOID_K,
    name: building.id || "Building",
    color: building.color,
    opacity: 1.0,
    lighting: {
      ambient: 0.6,
      diffuse: 0.9,
      specular: 0.4,
    },
    flatshading: true,
    showlegend: false,
  };
}

const RenderCity = ({
  regionElevationArray,
  regionMatrixWidth,
  regionMatrixHeight,
  regionWater = [],
  simulatedShapes = [],
  buildings = [],
  roads = []
}) => {
  const [elevationScale, setElevationScale] = useState(1);
  const [waterMask, setWaterMask] = useState(null);

  console.log("rods " + JSON.stringify(roads))

  // Convert flat elevation array to a 2D array
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
      rowArr.push(
        waterMask && waterMask[idx] === 1
          ? specialWaterValue
          : scaledZValues[row][col]
      );
    }
    colorValue2D.push(rowArr);
  }

  const fractionMinVal =
    (minOriginalVal * elevationScale - specialWaterValue) /
    (maxScaledVal - specialWaterValue);
  const customColorScale = [
    [0, "rgb(64, 173, 216)"],
    [fractionMinVal, "rgb(64, 173, 216)"],
    [fractionMinVal + 0.0001, "rgb(200,255,200)"],
    [1, "rgb(34,139,34)"],
  ];

  // 1) Main terrain surface trace
  const surfaceTrace = {
    z: scaledZValues,
    type: "surface",
    surfacecolor: colorValue2D,
    cmin: specialWaterValue,
    cmax: maxScaledVal,
    colorscale: customColorScale,
    showscale: false,
  };

  // 2) Draw simulated shapes as 3D closed polylines
  const shapeLineTraces = simulatedShapes
    .filter((shape) => !(shape.id && shape.id.startsWith("obstacle-")))
    .map((shape, shapeIndex) => {
      const polygon = shape.outerPolygon;
      if (!polygon || polygon.length < 2) return null;

      const xCoords = [];
      const yCoords = [];
      const zCoords = [];
      for (let i = 0; i < polygon.length; i++) {
        const [x, y] = polygon[i];
        const xClamped = clamp(Math.floor(x), regionMatrixWidth - 1);
        const yClamped = clamp(Math.floor(y), regionMatrixHeight - 1);
        xCoords.push(xClamped);
        yCoords.push(yClamped);
        zCoords.push(scaledZValues[yClamped][xClamped] + 2);
      }
      // Close the loop for a complete outline.
      xCoords.push(xCoords[0]);
      yCoords.push(yCoords[0]);
      zCoords.push(zCoords[0]);

      return {
        type: "scatter3d",
        mode: "lines",
        x: xCoords,
        y: yCoords,
        z: zCoords,
        name: shape.id || `Shape ${shapeIndex}`,
        line: { color: "grey", width: 6 },
        showlegend: false,
      };
    })
    .filter(Boolean);

  // 3) Draw roads as 3D polylines.
  //    We check if a road has an outerPolygon (or fallback to a "points" array)
  const roadLineTraces = roads
    .map((road, roadIndex) => {
      let points = [];
      if (road.outerPolygon && road.outerPolygon.length > 1) {
        points = road.outerPolygon;
      } else if (road.points && road.points.length > 1) {
        points = road.points;
      }
      if (points.length < 2) return null;

      const xCoords = [];
      const yCoords = [];
      const zCoords = [];
      for (let i = 0; i < points.length; i++) {
        const [x, y] = points[i];
        const xClamped = clamp(Math.floor(x), regionMatrixWidth - 1);
        const yClamped = clamp(Math.floor(y), regionMatrixHeight - 1);
        xCoords.push(xClamped);
        yCoords.push(yClamped);
        zCoords.push(scaledZValues[yClamped][xClamped] + 2); // slightly above surface
      }
      // Do not automatically close the road polyline unless it is meant to be closed.
      return {
        type: "scatter3d",
        mode: "lines",
        x: xCoords,
        y: yCoords,
        z: zCoords,
        name: road.id || `Road ${roadIndex}`,
        line: { color: "black", width: 8 },
        showlegend: false,
      };
    })
    .filter(Boolean);

  // 4) Draw buildings as cuboids (each as a mesh3d trace)
  const buildingMeshTraces = buildings
    .map((b) =>
      createBuildingMesh3D(b, scaledZValues, regionMatrixWidth, regionMatrixHeight)
    )
    .filter(Boolean);

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <label style={{ marginRight: "10px" }}>
          Elevation Scale: {elevationScale.toFixed(1)}
        </label>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={elevationScale}
          onChange={(e) => setElevationScale(Number(e.target.value))}
          style={{ width: "200px" }}
        />
      </div>

      <Plot
        data={[
          surfaceTrace,
          ...shapeLineTraces,
          ...roadLineTraces,
          ...buildingMeshTraces,
        ]}
        layout={{
          title: "City Elevation Surface (with Water, Roads, & Buildings)",
          autosize: true,
          paper_bgcolor: "#E0F7FF",
          plot_bgcolor: "#E0F7FF",
          scene: {
            bgcolor: "#E0F7FF",
            aspectmode: "manual",
            aspectratio: { x: 1, y: 1, z: 0.3 },
            xaxis: {
              title: "",
              showticklabels: false,
              showgrid: false,
              zeroline: false,
            },
            yaxis: {
              title: "",
              showticklabels: false,
              showgrid: false,
              zeroline: false,
            },
            zaxis: {
              title: "",
              showticklabels: false,
              showgrid: false,
              zeroline: false,
              range: [0, maxScaledVal * 1.2],
            },
          },
          margin: { l: 0, r: 0, t: 30, b: 0 },
          showlegend: false,
        }}
        style={{ width: "100%", height: "600px" }}
        config={{ responsive: true }}
      />
    </div>
  );
};

export default RenderCity;
