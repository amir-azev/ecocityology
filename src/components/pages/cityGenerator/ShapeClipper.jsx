import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Suspense,
} from 'react';
import { Button } from '@/components/ui/button';

// Constants
const GROWTH_RATE = 1.5; // Adjust the growth rate as needed
const CRITICAL_AREA = 10; // Critical area threshold for holes to be removed
const TIME_INTERVAL = 50; // Time interval for growth iterations
const divisionFactor = 0.15; // Adjust this factor to control the density of points

// Helper functions for geometry calculations

// Calculate the signed area of a polygon
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

// Ensure the polygon has the desired orientation
const ensurePolygonOrientation = (points, clockwise = true) => {
  const area = calculateSignedArea(points);
  if ((clockwise && area < 0) || (!clockwise && area > 0)) {
    return points.slice().reverse();
  }
  return points;
};

// Compute normals for a polygon
const computeNormals = (points) => {
  const normals = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];

    // Edge vectors
    const v1 = [p1[0] - p0[0], p1[1] - p0[1]];
    const v2 = [p2[0] - p1[0], p2[1] - p1[1]];

    // Normal vectors for edges
    const n1 = [-v1[1], v1[0]];
    const n2 = [-v2[1], v2[0]];

    // Average the normals
    const nx = (n1[0] + n2[0]) / 2;
    const ny = (n1[1] + n2[1]) / 2;

    // Normalize the normal vector
    const length = Math.hypot(nx, ny);
    normals.push([nx / length, ny / length]);
  }
  return normals;
};

// Calculate area of a polygon (absolute value)
const calculateArea = (points) => Math.abs(calculateSignedArea(points));

// Calculate perimeter of a polygon
const calculatePerimeter = (points) =>
  points.reduce((acc, point, i) => {
    const nextPoint = points[(i + 1) % points.length];
    return acc + Math.hypot(nextPoint[0] - point[0], nextPoint[1] - point[1]);
  }, 0);

// Function to resample the shape to have equally spaced divisions
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

// Function to simplify a polygon
const simplifyPolygon = (geojsonPolygon, jsts) => {
  const reader = new jsts.io.GeoJSONReader();
  const writer = new jsts.io.GeoJSONWriter();
  const geometry = reader.read(geojsonPolygon);
  const fixedGeometry = geometry.buffer(0);
  return writer.write(fixedGeometry);
};

// Get SVG path string from points
const getPathString = (points) =>
  points.map((point) => point.join(',')).join(' ');

// Subcomponent for Obstacle
const Obstacle = React.memo(({ obstacle }) => (
  <g>
    <polygon
      points={getPathString(obstacle.outerPolygon)}
      fill="gray"
      fillOpacity="0.5"
      stroke="gray"
      strokeWidth="2"
    />

  </g>
));

// Subcomponent for Hole
const Hole = React.memo(({ hole }) => (
  <g>
    <polygon
      points={getPathString(hole)}
      fill="white"
      fillOpacity="0.7"
      stroke="red"
      strokeWidth="2"
    />

  </g>
));

// Subcomponent for Shape
const Shape = React.memo(({ shape, index }) => (
  <g>
    <polygon
      points={getPathString(shape.outerPolygon)}
      fill={shape.isObstacle ? 'gray' : 'blue'}
      fillOpacity={shape.isObstacle ? '0.5' : '0.3'}
      stroke={shape.isObstacle ? 'gray' : 'blue'}
      strokeWidth="2"
    />

    {shape.holes.map((hole, holeIndex) => (
      <Hole key={`shape-${index}-hole-${holeIndex}`} hole={hole} />
    ))}
  </g>
));

// Main Component
function PolygonDrawer() {
  const [objects, setObjects] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [drawingType, setDrawingType] = useState(null); // 'shape', 'hole', 'obstacle'
  const [currentShapeIndex, setCurrentShapeIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Use ref to store the interval ID
  const intervalIdRef = useRef(null);

  // Handle SVG canvas click for adding points
  const handleSvgClick = useCallback(
    (e) => {
      const { offsetX, offsetY } = e.nativeEvent;
      const newPoint = [offsetX, offsetY];

      if (drawingType !== null) {
        setCurrentPoints((prevPoints) => [...prevPoints, newPoint]);
      }
    },
    [drawingType]
  );

  // Start drawing a new shape
  const handleStartDrawingShape = useCallback(() => {
    setDrawingType('shape');
    setCurrentPoints([]);
  }, []);

  // Start drawing a hole in the selected shape
  const handleStartDrawingHole = useCallback((shapeIndex) => {
    setDrawingType('hole');
    setCurrentShapeIndex(shapeIndex);
    setCurrentPoints([]);
  }, []);

  // Start drawing a new obstacle
  const handleStartDrawingObstacle = useCallback(() => {
    setDrawingType('obstacle');
    setCurrentPoints([]);
  }, []);

  // Finish drawing the current polygon, hole, or obstacle
  const handleFinishDrawing = useCallback(() => {
    if (currentPoints.length < 3) {
      alert('A polygon must have at least 3 points.');
      return;
    }
    let resampledPoints = resampleShape(currentPoints, divisionFactor);

    if (drawingType === 'shape' || drawingType === 'obstacle') {
      resampledPoints = ensurePolygonOrientation(resampledPoints, true); // Outer polygons counterclockwise
      setObjects((prevObjects) => [
        ...prevObjects,
        {
          outerPolygon: resampledPoints,
          holes: [],
          isObstacle: drawingType === 'obstacle',
        },
      ]);
    } else if (drawingType === 'hole' && currentShapeIndex !== null) {
      resampledPoints = ensurePolygonOrientation(resampledPoints, false); // Holes clockwise
      setObjects((prevObjects) => {
        const newObjects = prevObjects.map((shape, index) => {
          if (index === currentShapeIndex) {
            return { ...shape, holes: [...shape.holes, resampledPoints] };
          }
          return shape;
        });
        return newObjects;
      });
    }

    setDrawingType(null);
    setCurrentPoints([]);
    setCurrentShapeIndex(null);
  }, [currentPoints, drawingType, currentShapeIndex]);

  // Generate GeoJSON format output
  const finalGeoJSON = useMemo(() => {
    const shapes = objects.filter((obj) => !obj.isObstacle);
    if (shapes.length === 0) return null;
    if (shapes.length === 1) {
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [...shapes[0].outerPolygon, shapes[0].outerPolygon[0]],
            ...shapes[0].holes.map((hole) => [...hole, hole[0]]),
          ],
        },
        properties: {},
      };
    } else {
      return {
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: shapes.map((shape) => [
            [...shape.outerPolygon, shape.outerPolygon[0]],
            ...shape.holes.map((hole) => [...hole, hole[0]]),
          ]),
        },
        properties: {},
      };
    }
  }, [objects]);

  // Function to perform a growth iteration
  const performGrowthIteration = useCallback(() => {
    import('jsts').then((jsts) => {
      const reader = new jsts.io.GeoJSONReader();
      const writer = new jsts.io.GeoJSONWriter();
  
      // Convert all objects to JSTS geometries
      const objectGeometries = objects.map((obj) => {
        const coordinates = [
          [...obj.outerPolygon, obj.outerPolygon[0]],
          ...obj.holes.map((hole) => [...hole, hole[0]]),
        ];
        const geoJSON = {
          type: 'Polygon',
          coordinates: coordinates,
        };
        let geometry = reader.read(geoJSON);
  
        // Ensure geometry is valid
        geometry = geometry.buffer(0);
  
        return geometry;
      });
  
      // For each object, perform the growth iteration
      let newObjects = objects
        .map((obj, objIndex) => {
          if (obj.isObstacle) {
            // Obstacles remain unchanged
            return obj;
          }
  
          try {
            // Expand the geometry using buffer
            let geometry = objectGeometries[objIndex];
  
            let expandedGeometry = geometry.buffer(GROWTH_RATE);
  
            // Clean up the geometry
            expandedGeometry = expandedGeometry.buffer(0);
  
            // Union of obstacles and other shapes (excluding current one)
            let unionGeometry = null;
            for (let i = 0; i < objectGeometries.length; i++) {
              if (i !== objIndex) {
                if (unionGeometry) {
                  unionGeometry = unionGeometry.union(objectGeometries[i]);
                } else {
                  unionGeometry = objectGeometries[i];
                }
              }
            }
  
            // Ensure unionGeometry is valid
            if (unionGeometry) {
              unionGeometry = unionGeometry.buffer(0);
            }
  
            // Subtract obstacles and other shapes
            let finalGeometry = expandedGeometry;
            if (unionGeometry) {
              finalGeometry = expandedGeometry.difference(unionGeometry);
  
              // Ensure finalGeometry is valid
              finalGeometry = finalGeometry.buffer(0);
            }
  
            if (finalGeometry.isEmpty()) {
              // Shape has been completely absorbed
              return null;
            }
  
            // Convert finalGeometry back to GeoJSON
            const finalGeoJSON = writer.write(finalGeometry);
  
            // Now extract the simplified outerPolygon and holes
            if (finalGeoJSON.type === 'Polygon') {
              const newOuterPolygon = finalGeoJSON.coordinates[0].slice(0, -1);
              let newHolesList = finalGeoJSON.coordinates
                .slice(1)
                .map((hole) => hole.slice(0, -1));
  
              // Filter out holes that are below the critical area
              newHolesList = newHolesList.filter(
                (hole) => calculateArea(hole) > CRITICAL_AREA
              );
  
              // Optionally resample the shape
              const resampledOuter = resampleShape(newOuterPolygon, divisionFactor);
              const resampledHoles = newHolesList.map((hole) =>
                resampleShape(hole, divisionFactor)
              );
  
              return {
                outerPolygon: resampledOuter,
                holes: resampledHoles,
                isObstacle: false,
              };
            } else if (finalGeoJSON.type === 'MultiPolygon') {
              // Handle MultiPolygon
              // For simplicity, take the largest polygon
              let maxArea = 0;
              let maxPolygonIndex = 0;
              finalGeoJSON.coordinates.forEach((polygon, index) => {
                const area = Math.abs(calculateSignedArea(polygon[0]));
                if (area > maxArea) {
                  maxArea = area;
                  maxPolygonIndex = index;
                }
              });
              const largestPolygon = finalGeoJSON.coordinates[maxPolygonIndex];
              const newOuterPolygon = largestPolygon[0].slice(0, -1);
              let newHolesList = largestPolygon
                .slice(1)
                .map((hole) => hole.slice(0, -1));
  
              // Filter out holes that are below the critical area
              newHolesList = newHolesList.filter(
                (hole) => calculateArea(hole) > CRITICAL_AREA
              );
  
              // Optionally resample the shape
              const resampledOuter = resampleShape(newOuterPolygon, divisionFactor);
              const resampledHoles = newHolesList.map((hole) =>
                resampleShape(hole, divisionFactor)
              );
  
              return {
                outerPolygon: resampledOuter,
                holes: resampledHoles,
                isObstacle: false,
              };
            }
            return null; // In case we can't process, remove the shape
          } catch (e) {
            console.error('Geometry operation error:', e);
            return obj; // Keep the original shape if an error occurs
          }
        })
        .filter((obj) => obj !== null);
  
      setObjects(newObjects);
    });
  }, [objects]);
  
  // Use effect to handle play/pause functionality
  useEffect(() => {
    if (isPlaying) {
      intervalIdRef.current = setInterval(performGrowthIteration, TIME_INTERVAL);
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

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    const shapes = objects.filter((obj) => !obj.isObstacle);
    if (shapes.length === 0) {
      alert('Please draw at least one shape before playing.');
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [objects]);

  return (
    <div>
      <svg
        width="500"
        height="500"
        style={{ border: '1px solid black' }}
        onClick={handleSvgClick}
      >
        {/* Render shapes and obstacles */}
        {objects.map((shape, index) => (
          <Shape key={`shape-${index}`} shape={shape} index={index} />
        ))}

        {/* Render currently drawn polygon, hole, or obstacle */}
        {currentPoints.length > 0 && (
          <g>
            <polygon
              points={getPathString(currentPoints)}
              fill={
                drawingType === 'hole'
                  ? 'white'
                  : drawingType === 'obstacle'
                  ? 'gray'
                  : 'blue'
              }
              fillOpacity="0.5"
              stroke={
                drawingType === 'hole'
                  ? 'red'
                  : drawingType === 'obstacle'
                  ? 'gray'
                  : 'blue'
              }
              strokeWidth="2"
              strokeDasharray="4"
            />
            {/* Render red dots for current drawing points */}
            {currentPoints.map((point, index) => (
              <circle
                key={`current-point-${index}`}
                cx={point[0]}
                cy={point[1]}
                r="3"
                fill="red"
              />
            ))}
          </g>
        )}
      </svg>

      <div style={{ marginTop: '10px' }}>
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
          Confirm{' '}
          {drawingType === 'hole'
            ? 'Hole'
            : drawingType === 'obstacle'
            ? 'Obstacle'
            : 'Shape'}
        </Button>
        <Button onClick={togglePlayPause} disabled={drawingType !== null}>
          {isPlaying ? 'Pause' : 'Play'}
        </Button>

        {objects.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            <p>Select a shape to add holes:</p>
            {objects.map((shape, index) => {
              if (shape.isObstacle) return null;
              return (
                <Button
                  key={index}
                  onClick={() => handleStartDrawingHole(index)}
                  disabled={drawingType !== null || isPlaying}
                  style={{ marginRight: '5px', marginBottom: '5px' }}
                >
                  Add Hole to Shape {index + 1} [{shape.holes.length}]
                </Button>
              );
            })}
          </div>
        )}

        {finalGeoJSON && (
          <pre
            style={{ marginTop: '10px', background: '#f0f0f0', padding: '10px' }}
          >
            {JSON.stringify(finalGeoJSON, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default React.memo(PolygonDrawer);
