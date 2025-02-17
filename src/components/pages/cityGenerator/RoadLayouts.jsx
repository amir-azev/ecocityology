// PolygonDrawer.jsx
import React from "react";
import SvgPanZoomWrapper from "@/components/ui/SvgPanZoomWrapper";

// Helper: Calculate signed area (used for orientation and centroid calculation)
const calculateSignedArea = (points) => {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
};

// Helper: Calculate centroid of a polygon
const calculateCentroid = (points) => {
  let xSum = 0;
  let ySum = 0;
  const n = points.length;
  const area = calculateSignedArea(points);
  if (area === 0) return points[0];

  for (let i = 0; i < n; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % n];
    const factor = x0 * y1 - x1 * y0;
    xSum += (x0 + x1) * factor;
    ySum += (y0 + y1) * factor;
  }
  const factor = 1 / (6 * area);
  return [xSum * factor, ySum * factor];
};

// Helper: Convert a list of points to an SVG-compatible string
const getPathString = (points) =>
  points.map((point) => point.join(",")).join(" ");

// Renders a hole (an inner polygon)
const Hole = React.memo(({ hole }) => (
  <polygon
    points={getPathString(hole)}
    fill="white"
    fillOpacity="0.7"
    stroke="red"
    strokeWidth="2"
  />
));

// Renders a shape (polygon with optional holes)
const Shape = React.memo(({ shape, index }) => {
  const centroid = calculateCentroid(shape.outerPolygon);
  const area = Math.abs(calculateSignedArea(shape.outerPolygon));

  return (
    <g>
      <polygon
        points={getPathString(shape.outerPolygon)}
        fill={shape.color}
        fillOpacity={shape.isObstacle ? 0.5 : 0.3}
        stroke="black"
        strokeWidth="2"
      >
        <title>
          {shape.id ? `${shape.id}\n` : ""}
          Area: {area.toFixed(2)}
        </title>
      </polygon>
      {shape.holes.map((hole, holeIndex) => (
        <Hole key={`shape-${index}-hole-${holeIndex}`} hole={hole} />
      ))}
      {/* Display shape id at the centroid if the shape is not an obstacle */}
      {!shape.isObstacle && (
        <text
          x={centroid[0]}
          y={centroid[1]}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="12"
          fill="black"
          pointerEvents="none"
        >
          {shape.id}
        </text>
      )}
    </g>
  );
});

// Main component: only renders background image, water regions, and simulated shapes.
function PolygonDrawer({
  regionWater,           // Array of objects with a 'd' property (SVG path data for water)
  fullRegionImage,       // URL or data URL for the background image
  regionMatrixWidth,     // SVG width (number)
  regionMatrixHeight,    // SVG height (number)
  simulatedShapes,       // Array of shape objects (each with outerPolygon, holes, etc.)
}) {
  return (
    <SvgPanZoomWrapper>
      <svg
        width={regionMatrixWidth}
        height={regionMatrixHeight}
        style={{ border: "1px solid black", background: "white" }}
      >
        {/* Background image */}
        {fullRegionImage && (
          <image
            href={fullRegionImage}
            x={0}
            y={0}
            width={regionMatrixWidth}
            height={regionMatrixHeight}
          />
        )}
        {/* Water regions */}
        {regionWater &&
          regionWater.map((wf, idx) => (
            <path
              key={`water-${idx}`}
              d={wf.d}
              fill="rgb(64, 173, 216)"
              fillOpacity={0.4}
              stroke="none"
            />
          ))}
        {/* Simulated shapes */}
        {simulatedShapes &&
          simulatedShapes.map((shape, index) => (
            <Shape key={`shape-${index}`} shape={shape} index={index} />
          ))}
      </svg>
    </SvgPanZoomWrapper>
  );
}

export default React.memo(PolygonDrawer);
