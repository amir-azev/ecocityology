import React from "react";
import SvgPanZoomWrapper from "@/components/ui/SvgPanZoomWrapper";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

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
  if (area === 0 && points.length > 0) return points[0];
  if (area === 0) return [0, 0]; // fallback

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

// Helper: Convert multiple polygons (outer + holes) into one path string with "evenodd" fill
const getCombinedPathString = (outerPolygon, holes) => {
  const outerStr = "M " + outerPolygon.map((pt) => pt.join(",")).join(" ") + " z";
  const holesStr = holes
    .map((hole) => "M " + hole.map((pt) => pt.join(",")).join(" ") + " z")
    .join(" ");
  return outerStr + " " + holesStr;
};

// Helper: Get bounding box of a polygon
const getBoundingBox = (polygon) => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  polygon.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  return { minX, minY, maxX, maxY };
};

// Helper: Point in polygon using ray-casting algorithm
const pointInPolygon = (point, vs) => {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0],
      yi = vs[i][1];
    const xj = vs[j][0],
      yj = vs[j][1];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

// Helper: Rotate a point (px,py) around a center (cx,cy) by angle (in degrees)
const rotatePoint = (px, py, cx, cy, angleDeg) => {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
};

// Helper: Get rotated rectangle corners given top-left, width, height, and rotation (about center)
const getRotatedCorners = (x, y, width, height, rotation) => {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const corners = [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
  return corners.map(([px, py]) => rotatePoint(px, py, cx, cy, rotation));
};

// Helper: Projection of a point on an axis (represented as [ax, ay])
const dot = (p, q) => p[0] * q[0] + p[1] * q[1];

// Helper: Check if two convex polygons overlap using the Separating Axis Theorem (SAT)
const doPolygonsOverlap = (poly1, poly2) => {
  const polygons = [poly1, poly2];
  for (let i = 0; i < polygons.length; i++) {
    const polygon = polygons[i];
    for (let j = 0; j < polygon.length; j++) {
      // Get the current edge
      const p1 = polygon[j];
      const p2 = polygon[(j + 1) % polygon.length];
      // Get the axis perpendicular to the edge
      const axis = [p2[1] - p1[1], -(p2[0] - p1[0])];

      // Project both polygons onto the axis
      let minA = Infinity,
        maxA = -Infinity;
      for (const p of poly1) {
        const proj = dot(p, axis);
        minA = Math.min(minA, proj);
        maxA = Math.max(maxA, proj);
      }

      let minB = Infinity,
        maxB = -Infinity;
      for (const p of poly2) {
        const proj = dot(p, axis);
        minB = Math.min(minB, proj);
        maxB = Math.max(maxB, proj);
      }

      // Check if projections do not overlap
      if (maxA < minB || maxB < minA) {
        return false;
      }
    }
  }
  return true;
};

// Renders each shape; note that we pass along buildings and roads props if needed.
const Shape = React.memo(
  ({
    shape,
    index,
    regionMatrixWidth,
    regionMatrixHeight,
    drawGrid,
    gridScale,
    buildings,
    setBuildings,
    roads,
    setRoads,
  }) => {
    const centroid = calculateCentroid(shape.outerPolygon);
    const area = Math.abs(calculateSignedArea(shape.outerPolygon));

    const combinedPath = getCombinedPathString(shape.outerPolygon, shape.holes);
    const randomRotation = React.useMemo(() => Math.random() * 360, []);
    const patternSpacing = 10 * gridScale;

    const skipGrid =
      shape.id?.startsWith("obstacle") || shape.id?.startsWith("Green Spaces");

    return (
      <g>
        <path
          d={combinedPath}
          fill={shape.color}
          fillOpacity={shape.isObstacle ? 0.5 : 0.3}
          stroke="black"
          strokeWidth="2"
          fillRule="evenodd"
        >
          <title>
            {shape.id ? `${shape.id}\n` : ""}
            Area: {area.toFixed(2)}
          </title>
        </path>

        {drawGrid && !skipGrid && (
          <>
            <defs>
              <clipPath id={`clip-shape-${index}`}>
                <path d={combinedPath} fillRule="evenodd" />
              </clipPath>

              <pattern
                id={`grid-pattern-${index}`}
                patternUnits="userSpaceOnUse"
                width={patternSpacing}
                height={patternSpacing}
                patternTransform={`rotate(${randomRotation}, ${centroid[0]}, ${centroid[1]})`}
              >
                <path
                  d={`M 0,0 L 0,${patternSpacing} M 0,0 L ${patternSpacing},0`}
                  fill="none"
                  stroke="black"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <g clipPath={`url(#clip-shape-${index})`}>
              <rect
                fill={`url(#grid-pattern-${index})`}
                x={0}
                y={0}
                width={regionMatrixWidth}
                height={regionMatrixHeight}
              />
            </g>
          </>
        )}

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
  }
);

function RoadLayouts({
  regionWater,
  fullRegionImage,
  regionMatrixWidth,
  regionMatrixHeight,
  simulatedShapes,
  buildings,
  setBuildings,
  roads,
  setRoads,
}) {
  const [drawGrid, setDrawGrid] = React.useState(false);
  const [gridScale, setGridScale] = React.useState(1);

  // Generate non-overlapping building footprints inside shapes with a grid.
  const generateBuildings = () => {
    const newBuildings = [];

    simulatedShapes.forEach((shape, shapeIndex) => {
      // Skip shapes not eligible for grid or building placement.
      const skipGrid =
        shape.id?.startsWith("obstacle") || shape.id?.startsWith("Green Spaces");
      if (skipGrid) return;

      const bbox = getBoundingBox(shape.outerPolygon);
      // Continue trying until a set number of consecutive failed attempts.
      let consecutiveFails = 0;
      const maxFails = 20;

      while (consecutiveFails < maxFails) {
        // Random area between 10 and 80 for the footprint
        const minArea = 10;
        const maxArea = 80;
        const areaCandidate = minArea + Math.random() * (maxArea - minArea);

        // Random aspect ratio between 0.5 and 2
        const aspect = 0.5 + Math.random() * 1.5;
        const width = Math.sqrt(areaCandidate * aspect);
        const height = areaCandidate / width;

        // Pick a random center within the bounding box
        const cx = bbox.minX + Math.random() * (bbox.maxX - bbox.minX);
        const cy = bbox.minY + Math.random() * (bbox.maxY - bbox.minY);
        const x = cx - width / 2;
        const y = cy - height / 2;

        // Choose a base angle (0 or 90) then add a small random offset [-15,15] degrees.
        const baseAngle = Math.random() < 0.5 ? 0 : 90;
        const rotationOffset = -15 + Math.random() * 30;
        const rotation = baseAngle + rotationOffset;

        // Compute rotated corners
        const corners = getRotatedCorners(x, y, width, height, rotation);

        // Check if all four corners of the rectangle are inside the polygon
        const insidePolygon = corners.every((pt) =>
          pointInPolygon(pt, shape.outerPolygon)
        );

        if (!insidePolygon) {
          consecutiveFails++;
          continue;
        }

        // Check overlap against buildings already placed in this shape.
        // Use our SAT-based polygon overlap check.
        const candidatePoly = corners;
        const overlaps = newBuildings.some((b) => {
          if (b.shapeIndex !== shapeIndex) return false;
          return doPolygonsOverlap(candidatePoly, b.corners);
        });
        if (overlaps) {
          consecutiveFails++;
          continue;
        }

        // Generate a random building height (vertical descriptor) within a desired range (10 to 50)
        const buildingHeight = 10 + Math.random() * 40;

        // Building is valid, add it.
        newBuildings.push({
          x, // top-left of the unrotated rectangle (for SVG rendering)
          y,
          width,
          height, // footprint height
          rotation,
          // center of the rectangle (for SVG transform)
          cx: x + width / 2,
          cy: y + height / 2,
          // store its rotated corners for overlap checking
          corners,
          shapeIndex,
          buildingHeight,
          id: `${shape.id || "shape" + shapeIndex}-building-${newBuildings.length}`,
        });
        // Reset failure counter on a successful placement.
        consecutiveFails = 0;
      }
    });

    setBuildings(newBuildings);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-4">
        <Button onClick={() => setDrawGrid((prev) => !prev)}>
          {drawGrid ? "Hide Roads" : "Generate Roads"}
        </Button>

        <Button onClick={generateBuildings}>Generate Buildings</Button>

        <div className="w-64">
          <span className="block text-sm font-medium text-gray-700">
            Grid Density
          </span>
          <Slider
            defaultValue={[1]}
            min={0.1}
            max={2}
            step={0.1}
            value={[gridScale]}
            onValueChange={(val) => setGridScale(val[0])}
          />
          <span className="text-xs text-gray-500">
            Value: {gridScale.toFixed(1)}
          </span>
        </div>
      </div>

      <SvgPanZoomWrapper>
        <svg
          width={regionMatrixWidth}
          height={regionMatrixHeight}
          className="border border-gray-300 bg-white"
        >
          {fullRegionImage && (
            <image
              href={fullRegionImage}
              x={0}
              y={0}
              width={regionMatrixWidth}
              height={regionMatrixHeight}
            />
          )}

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

          {simulatedShapes &&
            simulatedShapes.map((shape, index) => (
              <Shape
                key={`shape-${index}`}
                shape={shape}
                index={index}
                regionMatrixWidth={regionMatrixWidth}
                regionMatrixHeight={regionMatrixHeight}
                drawGrid={drawGrid}
                gridScale={gridScale}
                buildings={buildings}
                setBuildings={setBuildings}
                roads={roads}
                setRoads={setRoads}
              />
            ))}

          {/* Render generated buildings */}
          {buildings.map((building) => (
            <rect
              key={building.id}
              x={building.x}
              y={building.y}
              width={building.width}
              height={building.height}
              fill="brown"
              fillOpacity="0.8"
              stroke="black"
              strokeWidth="1"
              transform={`rotate(${building.rotation}, ${building.cx}, ${building.cy})`}
            />
          ))}
        </svg>
      </SvgPanZoomWrapper>
    </div>
  );
}

export default React.memo(RoadLayouts);
