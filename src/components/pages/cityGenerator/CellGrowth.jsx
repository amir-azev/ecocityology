// PolygonDrawer.jsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Button } from "@/components/ui/button";
import SvgPanZoomWrapper from "@/components/ui/SvgPanZoomWrapper";

// Constants
const GROWTH_RATE_DEFAULT = 1.5;
const CRITICAL_AREA = 10;
const TIME_INTERVAL = 50;
const DIVISION_FACTOR = 0.15;
const OBSTACLE_CRITICAL_AREA = 20;
const DEFAULT_MAX_SHAPE_AREA = 8000; // Define a sensible default

const MAX_SHAPE_SCALE = 10;

// Helper functions for geometry
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

const ensurePolygonOrientation = (points, clockwise = true) => {
  const area = calculateSignedArea(points);
  const isCurrentlyClockwise = area < 0; // negative => clockwise
  if (
    (clockwise && isCurrentlyClockwise) ||
    (!clockwise && !isCurrentlyClockwise)
  ) {
    return points.slice().reverse();
  }
  return points;
};

const calculateArea = (points) => Math.abs(calculateSignedArea(points));

const calculatePerimeter = (points) =>
  points.reduce((acc, point, i) => {
    const nextPoint = points[(i + 1) % points.length];
    return acc + Math.hypot(nextPoint[0] - point[0], nextPoint[1] - point[1]);
  }, 0);

const resampleShape = (points, divisionFactor) => {
  const perimeter = calculatePerimeter(points);
  const divisions = Math.max(3, Math.round(perimeter * divisionFactor));
  const segmentLength = perimeter / divisions;
  let resampledPoints = [];
  let accumulatedDistance = 0;
  let currentIndex = 0;
  let currentPoint = points[0];
  resampledPoints.push([...currentPoint]);

  while (resampledPoints.length < divisions) {
    const nextPoint = points[(currentIndex + 1) % points.length];
    const dist = Math.hypot(
      nextPoint[0] - currentPoint[0],
      nextPoint[1] - currentPoint[1]
    );
    if (accumulatedDistance + dist >= segmentLength) {
      const ratio = (segmentLength - accumulatedDistance) / dist;
      const newX = currentPoint[0] + ratio * (nextPoint[0] - currentPoint[0]);
      const newY = currentPoint[1] + ratio * (nextPoint[1] - currentPoint[1]);
      resampledPoints.push([newX, newY]);
      currentPoint = [newX, newY];
      accumulatedDistance = 0;
    } else {
      accumulatedDistance += dist;
      currentPoint = nextPoint;
      currentIndex = (currentIndex + 1) % points.length;
    }
  }
  return resampledPoints;
};

const getPathString = (points) =>
  points.map((point) => point.join(",")).join(" ");

// Hole Component
const Hole = React.memo(({ hole }) => (
  <polygon
    points={getPathString(hole)}
    fill="white"
    fillOpacity="0.7"
    stroke="red"
    strokeWidth="2"
  />
));

// Centroid Calculation
const calculateCentroid = (points) => {
  let xSum = 0;
  let ySum = 0;
  const n = points.length;
  let area = calculateSignedArea(points);

  if (area === 0) {
    // Degenerate polygon; return first point
    return points[0];
  }

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

// Shape Component
const Shape = React.memo(({ shape, index }) => {
  const centroid = useMemo(
    () => calculateCentroid(shape.outerPolygon),
    [shape.outerPolygon]
  );
  const area = useMemo(
    () => calculateArea(shape.outerPolygon),
    [shape.outerPolygon]
  );

  console.log("shapecol  "+shape.color)
  return (
    <g>
      <polygon
        points={getPathString(shape.outerPolygon)}
        // Updated to always use shape.color:
        fill={shape.color}
        fillOpacity={shape.isObstacle ? 0.5 : 0.3}
        stroke="black"
        strokeWidth="2"
      >
        <title>
          {shape.id ? `${shape.id}\n` : ""}
          Area: {area.toFixed(2)}\n
          {shape.isObstacle ? "Obstacle" : "Shape"}\n
          {shape.growthRate ? `Growth Rate: ${shape.growthRate}` : ""}
          {shape.maxShapeArea ? `\nMax Area: ${shape.maxShapeArea}` : ""}
        </title>
      </polygon>
      {shape.holes.map((hole, holeIndex) => (
        <Hole key={`shape-${index}-hole-${holeIndex}`} hole={hole} />
      ))}
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

// Load jsts asynchronously
let jstsPromise = import("jsts").then((mod) => {
  const reader = new mod.io.GeoJSONReader();
  const writer = new mod.io.GeoJSONWriter();
  return { jsts: mod, reader, writer };
});

const parseMultiPolygonPath = (dString) => {
  const polygons = [];
  const regex = /M\s*([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)/gi;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(dString)) !== null) {
    if (match.index > lastIndex) {
      const subPath = dString.substring(lastIndex, match.index);
      if (subPath.trim().length > 0) {
        polygons.push(subPath);
      }
    }
    lastIndex = regex.lastIndex;
  }
  const lastSubPath = dString.substring(lastIndex);
  if (lastSubPath.trim().length > 0) {
    polygons.push(lastSubPath);
  }
  const parsedPolygons = polygons
    .map((path) => {
      const coords = path.match(/-?\d+(\.\d+)?/g);
      if (!coords) return null;
      const points = [];
      for (let i = 0; i < coords.length; i += 2) {
        const x = parseFloat(coords[i]);
        const y = parseFloat(coords[i + 1]);
        if (!isNaN(x) && !isNaN(y)) {
          points.push([x, y]);
        }
      }
      return points;
    })
    .filter(Boolean);

  return parsedPolygons;
};

/**
 * Compute gradient (∂h/∂x, ∂h/∂y) for a given elevation matrix.
 */
function computeGradient(
  elevationMatrix,
  width,
  height,
  step = 20 // we skip pixels for visualization
) {
  if (!elevationMatrix || width <= 2 || height <= 2) {
    return [];
  }

  const result = [];
  const halfCell = 1; // for finite diff

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const h00 = elevationMatrix[y * width + x];

      const hXp = elevationMatrix[y * width + (x + halfCell)] || h00;
      const hXm = elevationMatrix[y * width + (x - halfCell)] || h00;
      const gradX = (hXp - hXm) / (2 * halfCell);

      const hYp = elevationMatrix[(y + halfCell) * width + x] || h00;
      const hYm = elevationMatrix[(y - halfCell) * width + x] || h00;
      const gradY = (hYp - hYm) / (2 * halfCell);

      result.push({
        x,
        y,
        gradX,
        gradY,
      });
    }
  }
  return result;
}

/**
 * A small component to render the gradient vector field arrows.
 */
function VectorFieldOverlay({ fieldData, scale = 10 }) {
  if (!fieldData || fieldData.length === 0) return null;

  const colorForGradient = (gradX, gradY) => {
    const magnitude = Math.sqrt(gradX * gradX + gradY * gradY);
    const c = Math.min(255, Math.floor(magnitude * 10 + 50));
    return `rgb(${c},${c},0)`;
  };

  return (
    <g>
      {fieldData.map((d, i) => {
        const { x, y, gradX, gradY } = d;
        const x2 = x + scale * gradX;
        const y2 = y + scale * gradY;
        return (
          <line
            key={i}
            x1={x}
            y1={y}
            x2={x2}
            y2={y2}
            stroke={colorForGradient(gradX, gradY)}
            strokeWidth="1"
          />
        );
      })}
    </g>
  );
}

/**
 * Main Component
 *
 * Props:
 * - regionWater: array of { d: string } polygons
 * - fullRegionImage: string URL/data URL for the terrain image
 * - regionElevationArray: Float32Array of elevations
 * - regionMatrixWidth: number
 * - regionMatrixHeight: number
 * - cityShapes: array of shapes (id, outerPolygon, holes, etc.)
 */
function PolygonDrawer({
  regionWater,
  fullRegionImage,
  regionElevationArray,
  regionMatrixWidth,
  regionMatrixHeight,
  cityShapes, // New prop
  simulatedShapes, setSimulatedShapes
}) {
  // const [simulatedShapes, setSimulatedShapes] = useState([]); // shapes and obstacles
  const [currentPoints, setCurrentPoints] = useState([]);
  const [drawingType, setDrawingType] = useState(null); // 'shape', 'hole', 'obstacle'
  const [currentShapeIndex, setCurrentShapeIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // New state for user inputs
  const [selectedColor, setSelectedColor] = useState("#ff0000");
  const [selectedGrowthRate, setSelectedGrowthRate] =
    useState(GROWTH_RATE_DEFAULT);
  const [selectedMaxShapeArea, setSelectedMaxShapeArea] = useState(
    DEFAULT_MAX_SHAPE_AREA
  );

  const jstsRef = useRef(null);
  const intervalIdRef = useRef(null);

  useEffect(() => {
    jstsPromise.then(({ jsts, reader, writer }) => {
      jstsRef.current = { jsts, reader, writer };
    });
  }, []);

  // Initialize simulatedShapes with cityShapes when cityShapes prop changes
  useEffect(() => {
    if (cityShapes && cityShapes.length > 0) {
      setSimulatedShapes((prevObjects) => {
        const existingIds = new Set(prevObjects.map((obj) => obj.id));
        const newCityShapes = cityShapes.filter(
          (shape) => !existingIds.has(shape.id)
        );
        return [...prevObjects, ...newCityShapes];
      });
    }
  }, [cityShapes]);

  // Convert regionWater polygons into obstacles
  useEffect(() => {
    if (!regionWater || regionWater.length === 0) return;

    setSimulatedShapes((prev) => {
      const newObstacles = regionWater.flatMap((wf) => {
        const polygons = parseMultiPolygonPath(wf.d);
        return polygons.map((points) => {
          let oriented = ensurePolygonOrientation(points, true);
          oriented = resampleShape(oriented, DIVISION_FACTOR);
          return {
            id: `obstacle-${Date.now()}-${Math.random()}`,
            outerPolygon: oriented,
            holes: [],
            isObstacle: true,
            color: 'rgb(64, 173, 216)', // default obstacle color
            growthRate: undefined,
            maxShapeArea: undefined,
          };
        });
      });

      if (jstsRef.current) {
        const { reader, writer } = jstsRef.current;
        const obstacleGeometries = newObstacles
          .map((obstacle) => {
            const geoJSON = {
              type: "Polygon",
              coordinates: [
                [...obstacle.outerPolygon, obstacle.outerPolygon[0]],
                ...obstacle.holes.map((hole) => [...hole, hole[0]]),
              ],
            };
            return reader.read(geoJSON).buffer(0);
          })
          .filter((geom) => geom && !geom.isEmpty());
        let combinedGeometry = null;
        obstacleGeometries.forEach((geom) => {
          combinedGeometry = combinedGeometry
            ? combinedGeometry.union(geom)
            : geom;
        });
        if (combinedGeometry) {
          combinedGeometry = combinedGeometry.buffer(0);
          const combinedGeoJSON = writer.write(combinedGeometry);
          if (combinedGeoJSON.type === "Polygon") {
            const outer = combinedGeoJSON.coordinates[0].slice(0, -1);
            if (calculateArea(outer) >= OBSTACLE_CRITICAL_AREA) {
              return [
                ...prev,
                {
                  id: `obstacle-${Date.now()}`,
                  outerPolygon: resampleShape(outer, DIVISION_FACTOR),
                  holes: [],
                  isObstacle: true,
                  color: 'rgb(64, 173, 216)',
                  growthRate: undefined,
                  maxShapeArea: undefined,
                },
              ];
            }
            return prev;
          } else if (combinedGeoJSON.type === "MultiPolygon") {
            const multiPolygons = combinedGeoJSON.coordinates
              .map((polygon) => {
                const outer = polygon[0].slice(0, -1);
                if (calculateArea(outer) >= OBSTACLE_CRITICAL_AREA) {
                  return {
                    id: `obstacle-${Date.now()}-${Math.random()}`,
                    outerPolygon: resampleShape(outer, DIVISION_FACTOR),
                    holes: [],
                    isObstacle: true,
                    color: 'rgb(64, 173, 216)',
                    growthRate: undefined,
                    maxShapeArea: undefined,
                  };
                }
                return null;
              })
              .filter(Boolean);
            return [...prev, ...multiPolygons];
          }
        }
      }
      return [...prev, ...newObstacles];
    });
  }, [regionWater]);

  // Precompute union of obstacles
  const obstaclesUnion = useMemo(() => {
    if (!jstsRef.current) return null;
    const { reader } = jstsRef.current;
    let unionGeom = null;
    simulatedShapes.forEach((obj) => {
      if (obj.isObstacle) {
        const geoJSON = {
          type: "Polygon",
          coordinates: [
            [...obj.outerPolygon, obj.outerPolygon[0]],
            ...obj.holes.map((hole) => [...hole, hole[0]]),
          ],
        };
        let geom = reader.read(geoJSON).buffer(0);
        unionGeom = unionGeom ? unionGeom.union(geom) : geom;
      }
    });
    return unionGeom ? unionGeom.buffer(0) : null;
  }, [simulatedShapes]);

  // Precompute union of all non-obstacle shapes
  const allShapesUnion = useMemo(() => {
    if (!jstsRef.current) return null;
    const { reader } = jstsRef.current;
    let unionGeom = null;
    simulatedShapes.forEach((obj) => {
      if (!obj.isObstacle) {
        const geoJSON = {
          type: "Polygon",
          coordinates: [
            [...obj.outerPolygon, obj.outerPolygon[0]],
            ...obj.holes.map((hole) => [...hole, hole[0]]),
          ],
        };
        let geom = reader.read(geoJSON).buffer(0);
        unionGeom = unionGeom ? unionGeom.union(geom) : geom;
      }
    });
    return unionGeom ? unionGeom.buffer(0) : null;
  }, [simulatedShapes]);

  // Precompute gradient vector field
  const vectorFieldDataRef = useRef([]);
  useEffect(() => {
    if (
      regionElevationArray &&
      regionMatrixWidth >= 2 &&
      regionMatrixHeight >= 2
    ) {
      vectorFieldDataRef.current = computeGradient(
        regionElevationArray,
        regionMatrixWidth,
        regionMatrixHeight,
        10
      );
    } else {
      vectorFieldDataRef.current = [];
    }
  }, [regionElevationArray, regionMatrixWidth, regionMatrixHeight]);

  function findNearestGradient(px, py, vectorFieldData) {
    let nearest = null;
    let minDist = Infinity;
    for (const g of vectorFieldData) {
      const dx = px - g.x;
      const dy = py - g.y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        nearest = g;
      }
    }
    return nearest || { gradX: 0, gradY: 0 };
  }

  // Growth iteration
  const performGrowthIteration = useCallback(() => {
    if (!jstsRef.current) return;
    const { reader, writer } = jstsRef.current;

    const boundingBoxGeoJSON = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [regionMatrixWidth, 0],
          [regionMatrixWidth, regionMatrixHeight],
          [0, regionMatrixHeight],
          [0, 0],
        ],
      ],
    };
    let boundingBoxGeom;
    try {
      boundingBoxGeom = reader.read(boundingBoxGeoJSON).buffer(0);
      if (boundingBoxGeom.isEmpty() || !boundingBoxGeom.isValid()) {
        console.error("Invalid bounding box geometry.");
        return;
      }
    } catch (e) {
      console.error("Error creating bounding box geometry:", e);
      return;
    }

    const vectorFieldData = vectorFieldDataRef.current;
    const k = 0.9; // Tuning factor

    const newObjects = simulatedShapes
      .map((obj) => {
        if (obj.isObstacle) {
          return obj;
        }

        try {
          const geoJSON = {
            type: "Polygon",
            coordinates: [
              [...obj.outerPolygon, obj.outerPolygon[0]],
              ...obj.holes.map((hole) => [...hole, hole[0]]),
            ],
          };
          let geometry = reader.read(geoJSON).buffer(0);
          if (geometry.isEmpty() || !geometry.isValid()) {
            console.warn("Invalid geometry for object, skipping:", obj);
            return null;
          }

          const coords = obj.outerPolygon;
          const n = coords.length;
          const currentArea = calculateArea(coords);
          if (currentArea >= obj.maxShapeArea * MAX_SHAPE_SCALE) {
            return obj;
          }

          const newCoords = coords.map((p, i) => {
            const [x0, y0] = p;
            const pPrev = coords[(i - 1 + n) % n];
            const pNext = coords[(i + 1) % n];
            const tx = pNext[0] - pPrev[0];
            const ty = pNext[1] - pPrev[1];
            let nx = -ty;
            let ny = tx;
            const len = Math.hypot(nx, ny) || 1.0;
            nx /= len;
            ny /= len;
            const grad = findNearestGradient(x0, y0, vectorFieldData);
            const { gradX, gradY } = grad;
            const dot = gradX * nx + gradY * ny;
            let scale = 1.0;
            if (dot > 0) {
              scale = Math.max(0.0, 1 - k * dot);
            }
            const localGrowth = obj.growthRate * scale;
            const xNew = x0 + localGrowth * nx;
            const yNew = y0 + localGrowth * ny;
            return [xNew, yNew];
          });

          const newOuterCoords = [...newCoords, newCoords[0]];
          const newGeoJSON = {
            type: "Polygon",
            coordinates: [
              newOuterCoords,
              ...obj.holes.map((hole) => [...hole, hole[0]]),
            ],
          };
          let newGeom = reader.read(newGeoJSON).buffer(0);
          newGeom = newGeom.buffer(0);
          if (newGeom.isEmpty() || !newGeom.isValid()) {
            console.warn(
              "Invalid geometry after growth, skipping:",
              obj
            );
            return null;
          }

          newGeom = newGeom.intersection(boundingBoxGeom);
          newGeom = newGeom.buffer(0);
          if (newGeom.isEmpty() || !newGeom.isValid()) {
            console.warn(
              "Geometry empty or invalid after clipping, skipping:",
              obj
            );
            return null;
          }

          if (obstaclesUnion) {
            newGeom = newGeom.difference(obstaclesUnion).buffer(0);
            if (newGeom.isEmpty() || !newGeom.isValid()) {
              console.warn(
                "Geometry empty or invalid after subtracting obstacles, skipping:",
                obj
              );
              return null;
            }
          }

          if (allShapesUnion) {
            newGeom = newGeom
              .difference(allShapesUnion.difference(geometry))
              .buffer(0);
            if (newGeom.isEmpty() || !newGeom.isValid()) {
              console.warn(
                "Geometry empty or invalid after subtracting other shapes, skipping:",
                obj
              );
              return null;
            }
          }

          const finalGeoJSON = writer.write(newGeom);
          let updatedObject = null;

          if (finalGeoJSON.type === "Polygon") {
            const newOuterPolygon = finalGeoJSON.coordinates[0].slice(0, -1);
            let newHolesList = finalGeoJSON.coordinates
              .slice(1)
              .map((hole) => hole.slice(0, -1));
            newHolesList = newHolesList.filter(
              (hole) => calculateArea(hole) > CRITICAL_AREA
            );
            const resampledOuter = resampleShape(
              newOuterPolygon,
              DIVISION_FACTOR
            );
            const resampledHoles = newHolesList.map((hole) =>
              resampleShape(hole, DIVISION_FACTOR)
            );
            updatedObject = {
              outerPolygon: resampledOuter,
              holes: resampledHoles,
              isObstacle: false,
              color: obj.color,
              growthRate: obj.growthRate,
              maxShapeArea: obj.maxShapeArea,
              id: obj.id,
            };
          } else if (finalGeoJSON.type === "MultiPolygon") {
            let maxArea = 0;
            let maxPolygon = null;
            finalGeoJSON.coordinates.forEach((polygon) => {
              const area = Math.abs(calculateSignedArea(polygon[0]));
              if (area > maxArea) {
                maxArea = area;
                maxPolygon = polygon;
              }
            });
            if (maxPolygon) {
              const newOuterPolygon = maxPolygon[0].slice(0, -1);
              let newHolesList = maxPolygon
                .slice(1)
                .map((hole) => hole.slice(0, -1));
              newHolesList = newHolesList.filter(
                (hole) => calculateArea(hole) > CRITICAL_AREA
              );
              const resampledOuter = resampleShape(
                newOuterPolygon,
                DIVISION_FACTOR
              );
              const resampledHoles = newHolesList.map((hole) =>
                resampleShape(hole, DIVISION_FACTOR)
              );
              updatedObject = {
                outerPolygon: resampledOuter,
                holes: resampledHoles,
                isObstacle: false,
                color: obj.color,
                growthRate: obj.growthRate,
                maxShapeArea: obj.maxShapeArea,
                id: obj.id,
              };
            }
          }

          if (!updatedObject) {
            console.warn("Failed to process final geometry, skipping:", obj);
            return null;
          }

          const newArea = calculateArea(updatedObject.outerPolygon);
          if (newArea > updatedObject.maxShapeArea * MAX_SHAPE_SCALE) {
            return obj;
          }

          return updatedObject;
        } catch (e) {
          console.error("Geometry operation error:", e, "for object:", obj);
          return obj;
        }
      })
      .filter((obj) => obj !== null);

    setSimulatedShapes(newObjects);
  }, [
    jstsRef,
    regionMatrixWidth,
    regionMatrixHeight,
    simulatedShapes,
    obstaclesUnion,
    allShapesUnion,
  ]);

  // Handle growth simulation interval
  useEffect(() => {
    if (isPlaying) {
      intervalIdRef.current = setInterval(
        performGrowthIteration,
        TIME_INTERVAL
      );
    } else if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [isPlaying, performGrowthIteration]);

  const togglePlayPause = useCallback(() => {
    const shapes = simulatedShapes.filter((o) => !o.isObstacle);
    if (!isPlaying && shapes.length === 0) {
      alert("Please draw at least one shape before playing.");
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [simulatedShapes, isPlaying]);

  // SVG click handler for drawing
  const handleSvgClick = useCallback(
    (wrapperCoords, svgCoords, e) => {
      if (drawingType !== null) {
        const newPoint = [svgCoords.x, svgCoords.y];
        setCurrentPoints((prevPoints) => [...prevPoints, newPoint]);
      }
    },
    [drawingType]
  );

  const handleStartDrawingShape = useCallback(() => {
    setDrawingType("shape");
    setCurrentPoints([]);
  }, []);

  const handleStartDrawingObstacle = useCallback(() => {
    setDrawingType("obstacle");
    setCurrentPoints([]);
  }, []);

  const handleStartDrawingHole = useCallback((shapeIndex) => {
    setDrawingType("hole");
    setCurrentShapeIndex(shapeIndex);
    setCurrentPoints([]);
  }, []);

  const handleFinishDrawing = useCallback(() => {
    if (currentPoints.length < 3) {
      alert("A polygon must have at least 3 points.");
      return;
    }
    let resampledPoints = resampleShape(currentPoints, DIVISION_FACTOR);
    if (drawingType === "shape" || drawingType === "obstacle") {
      const clockwise = drawingType === "obstacle";
      resampledPoints = ensurePolygonOrientation(resampledPoints, clockwise);
      const newShape = {
        id: `shape-${Date.now()}`,
        outerPolygon: resampledPoints,
        holes: [],
        isObstacle: drawingType === "obstacle",
        color: drawingType === "shape" ? selectedColor : 'rgb(64, 173, 216)',
        growthRate:
          drawingType === "shape"
            ? parseFloat(selectedGrowthRate) || GROWTH_RATE_DEFAULT
            : undefined,
        maxShapeArea:
          drawingType === "shape"
            ? parseFloat(selectedMaxShapeArea) || DEFAULT_MAX_SHAPE_AREA
            : undefined,
      };

      setSimulatedShapes((prevObjects) => [...prevObjects, newShape]);
    } else if (drawingType === "hole" && currentShapeIndex !== null) {
      resampledPoints = ensurePolygonOrientation(resampledPoints, false);
      setSimulatedShapes((prevObjects) => {
        return prevObjects.map((shape, idx) => {
          if (idx === currentShapeIndex) {
            return {
              ...shape,
              holes: [...shape.holes, resampledPoints],
            };
          }
          return shape;
        });
      });
    }
    setDrawingType(null);
    setCurrentPoints([]);
    setCurrentShapeIndex(null);
  }, [
    currentPoints,
    drawingType,
    currentShapeIndex,
    selectedColor,
    selectedGrowthRate,
    selectedMaxShapeArea,
  ]);

  // Export data handler
  const handleExportData = useCallback(() => {
    const elevationArray = regionElevationArray
      ? Array.from(regionElevationArray)
      : [];
    const updatedCityShapes = simulatedShapes.filter((obj) => !obj.isObstacle);
    const dataToExport = {
      regionWater,
      fullRegionImage,
      regionElevationArray: elevationArray,
      regionMatrixWidth,
      regionMatrixHeight,
      cityShapes: updatedCityShapes,
    };

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "exportData.txt";
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [
    regionWater,
    fullRegionImage,
    regionElevationArray,
    regionMatrixWidth,
    regionMatrixHeight,
    simulatedShapes,
  ]);

  /**
   * Render the terrain background and water polygons.
   */
  const renderTerrainBackground = () => {
    if (!fullRegionImage) return null;

    return (
      <g>
        <image
          href={fullRegionImage}
          x={0}
          y={0}
          width={regionMatrixWidth}
          height={regionMatrixHeight}
        />
        {regionWater.map((wf, idx) => (
          <path
            key={`water-${idx}`}
            d={wf.d}
            fill='rgb(64, 173, 216)'
            fillOpacity={0.4}
            stroke="none"
          />
        ))}
      </g>
    );
  };

  console.log("simshapes " + JSON.stringify(simulatedShapes))

  return (
    <div>
      <SvgPanZoomWrapper onSvgClick={handleSvgClick}>
        <svg
          width={regionMatrixWidth}
          height={regionMatrixHeight}
          style={{ border: "1px solid black", background: "white" }}
        >
          {renderTerrainBackground()}
          {simulatedShapes.map((shape, index) => (
            <Shape key={`shape-${index}`} shape={shape} index={index} />
          ))}
          {currentPoints.length > 0 && (
            <g>
              <polygon
                points={getPathString(currentPoints)}
                fill={
                  drawingType === "hole"
                    ? "white"
                    : drawingType === "obstacle"
                    ? "gray"
                    : "red"
                }
                fillOpacity="0.5"
                stroke={
                  drawingType === "hole"
                    ? "red"
                    : drawingType === "obstacle"
                    ? "gray"
                    : 'rgb(64, 173, 216)'
                }
                strokeWidth="2"
                strokeDasharray="4"
              />
              {currentPoints.map((point, idx) => (
                <circle
                  key={`current-point-${idx}`}
                  cx={point[0]}
                  cy={point[1]}
                  r="3"
                  fill="red"
                />
              ))}
            </g>
          )}
          {/* Uncomment to render gradient vector field overlay */}
          {/* <VectorFieldOverlay fieldData={vectorFieldDataRef.current} scale={10} /> */}
        </svg>
      </SvgPanZoomWrapper>

      <div style={{ marginTop: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Button
            onClick={handleStartDrawingShape}
            disabled={drawingType !== null || isPlaying}
          >
            Draw Shape
          </Button>
          <Button
            onClick={handleStartDrawingObstacle}
            disabled={drawingType !== null || isPlaying}
          >
            Draw Obstacle
          </Button>
          <Button onClick={handleFinishDrawing} disabled={drawingType === null}>
            Confirm{" "}
            {drawingType === "hole"
              ? "Hole"
              : drawingType === "obstacle"
              ? "Obstacle"
              : "Shape"}
          </Button>
          <Button onClick={togglePlayPause} disabled={drawingType !== null}>
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button onClick={handleExportData} variant="outline">
            Export Data
          </Button>
        </div>

        {drawingType === "shape" && (
          <div
            style={{
              marginTop: "10px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <label>
              Color:
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                style={{ marginLeft: "5px" }}
              />
            </label>
            <label>
              Growth Rate:
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={selectedGrowthRate}
                onChange={(e) => setSelectedGrowthRate(e.target.value)}
                style={{ marginLeft: "5px", width: "60px" }}
              />
            </label>
            <label>
              Max Area:
              <input
                type="number"
                step="10"
                min="10"
                value={selectedMaxShapeArea}
                onChange={(e) => setSelectedMaxShapeArea(e.target.value)}
                style={{ marginLeft: "5px", width: "80px" }}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(PolygonDrawer);
