import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import { Button } from "@/components/ui/button";
import SvgPanZoomWrapper from "@/components/ui/SvgPanZoomWrapper";

const mapContainerStyles = "w-[600px] h-[400px] border border-black";
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function TopographicMap({
  selectedLngLat,
  setSelectedLngLat,
  radiusKm,
  setRadiusKm,
  regionTiles,
  setRegionTiles,
  regionWater,
  setRegionWater,
  regionElevationArray,
  setregionElevationArray,
  regionMatrixWidth,
  setRegionMatrixWidth,
  regionMatrixHeight,
  setRegionMatrixHeight,
  fullRegionImage,
  setFullRegionImage,
  setRegionWaterPaths,
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);

  // Initialize Mapbox only once
  useEffect(() => {
    if (map.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-95.9345, 41.2565],
      zoom: 12,
    });

    map.current.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      setSelectedLngLat({ lng, lat });
    });
  }, [setSelectedLngLat]);

  /**
   * Draw circle whenever selectedLngLat or radiusKm changes
   */
  useEffect(() => {
    if (!map.current) return;
    if (!selectedLngLat) return;
    drawCircle(selectedLngLat.lng, selectedLngLat.lat, radiusKm);
  }, [selectedLngLat, radiusKm]);

  const drawCircle = (lng, lat, kmRadius) => {
    const currentMap = map.current;
    if (currentMap.getLayer("circle-layer")) {
      currentMap.removeLayer("circle-layer");
    }
    if (currentMap.getSource("circle-source")) {
      currentMap.removeSource("circle-source");
    }

    const point = turf.point([lng, lat]);
    const circleGeoJSON = turf.circle(point, kmRadius, {
      steps: 64,
      units: "kilometers",
    });

    currentMap.addSource("circle-source", {
      type: "geojson",
      data: circleGeoJSON,
    });

    currentMap.addLayer({
      id: "circle-layer",
      type: "fill",
      source: "circle-source",
      paint: {
        "fill-color": "#00abff",
        "fill-opacity": 0.2,
      },
    });
  };

  /**
   * Generate the full region (multiple tiles + water polygons)
   * and store results in the parent's state.
   * Also build a single elevation matrix for the entire area.
   */
  const handleGenerateRegionMap = async () => {
    if (!selectedLngLat) return;

    // 1) Create circle bounding box
    const point = turf.point([selectedLngLat.lng, selectedLngLat.lat]);
    const circleGeoJSON = turf.circle(point, radiusKm, {
      steps: 64,
      units: "kilometers",
    });
    const [west, south, east, north] = turf.bbox(circleGeoJSON);
    const zoom = 12;

    // 2) Convert bounding box corners to tile coords
    const { x: minTileX, y: minTileY } = lngLatToTile(west, north, zoom);
    const { x: maxTileX, y: maxTileY } = lngLatToTile(east, south, zoom);

    const tilePromises = [];
    const waterPromises = [];
    const tilesData = [];

    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = minTileY; y <= maxTileY; y++) {
        const terrainUrl = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${x}/${y}.pngraw?access_token=${MAPBOX_TOKEN}`;
        tilePromises.push(
          fetchTileAsElevations(terrainUrl, x, y)
            .then((td) => {
              if (td) tilesData.push(td);
              return td;
            })
            .catch((err) => {
              console.error(err);
              return null;
            })
        );

        const vectorUrl = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${zoom}/${x}/${y}.mvt?access_token=${MAPBOX_TOKEN}`;
        // Pass minTileX, minTileY so we can offset each path into a global coordinate system
        waterPromises.push(
          fetchVectorTileForWater(vectorUrl, x, y, minTileX, minTileY)
        );
      }
    }

    await Promise.all(tilePromises);
    const waterFeaturesNested = await Promise.all(waterPromises);

    // 3) Compute global min/max for all elevation data
    if (tilesData.length === 0) return;
    let globalMin = Number.POSITIVE_INFINITY;
    let globalMax = Number.NEGATIVE_INFINITY;
    tilesData.forEach((td) => {
      for (let i = 0; i < td.elevations.length; i++) {
        const elev = td.elevations[i];
        if (elev < globalMin) globalMin = elev;
        if (elev > globalMax) globalMax = elev;
      }
    });

    // 4) Colorize each tile (for individual overlays) and store in parent state
    const finalTiles = tilesData.map((td) => {
      const imgUrl = colorizeTile(
        td.width,
        td.height,
        td.elevations,
        globalMin,
        globalMax
      );
      return { x: td.x, y: td.y, imgUrl };
    });

    // Flatten water features (already offset globally)
    const allWater = waterFeaturesNested.flat().filter(Boolean);

    setRegionTiles(finalTiles);
    setRegionWater(allWater);

    const rawWaterPaths = allWater.map((wf) => wf.d);
    setRegionWaterPaths(rawWaterPaths);

    // 5) Build a single elevation matrix for the entire bounding box
    const { matrix, width, height } = buildregionElevationArray(
      tilesData,
      minTileX,
      minTileY,
      maxTileX,
      maxTileY
    );
    setregionElevationArray(matrix);
    setRegionMatrixWidth(width);
    setRegionMatrixHeight(height);

    // 6) Stitch all tile images into a single image
    try {
      const stitchedImageUrl = await stitchTiles(
        finalTiles,
        minTileX,
        minTileY,
        maxTileX,
        maxTileY
      );
      setFullRegionImage(stitchedImageUrl);
    } catch (error) {
      console.error("Error stitching tiles:", error);
    }
  };

  // -------------------------------
  //  Stitch tiles into single image
  // -------------------------------
  const stitchTiles = async (tiles, minTileX, minTileY, maxTileX, maxTileY) => {
    const tileCols = maxTileX - minTileX + 1;
    const tileRows = maxTileY - minTileY + 1;

    const regionWidth = tileCols * 256;
    const regionHeight = tileRows * 256;

    // Create a canvas with the size of the entire region
    const canvas = document.createElement("canvas");
    canvas.width = regionWidth;
    canvas.height = regionHeight;
    const ctx = canvas.getContext("2d");

    // Load all images
    const imagePromises = tiles.map((tile) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; // To avoid CORS issues
        img.src = tile.imgUrl;
        img.onload = () => resolve({ img, tile });
        img.onerror = reject;
      });
    });

    const loadedImages = await Promise.all(imagePromises);

    // Draw each image onto the canvas
    loadedImages.forEach(({ img, tile }) => {
      const offsetX = (tile.x - minTileX) * 256;
      const offsetY = (tile.y - minTileY) * 256;
      ctx.drawImage(img, offsetX, offsetY, 256, 256);
    });

    // Convert the canvas to a data URL
    return canvas.toDataURL("image/png");
  };

  // -------------------------------------------
  //  Build a single stitched elevation matrix
  // -------------------------------------------
  function buildregionElevationArray(
    tilesData,
    minTileX,
    minTileY,
    maxTileX,
    maxTileY
  ) {
    const tileCols = maxTileX - minTileX + 1;
    const tileRows = maxTileY - minTileY + 1;

    // Each Mapbox tile is 256 x 256
    const regionWidth = tileCols * 256;
    const regionHeight = tileRows * 256;

    const matrix = new Float32Array(regionWidth * regionHeight);

    tilesData.forEach((tile) => {
      const offsetX = (tile.x - minTileX) * 256;
      const offsetY = (tile.y - minTileY) * 256;

      for (let row = 0; row < tile.height; row++) {
        for (let col = 0; col < tile.width; col++) {
          const tileIndex = row * tile.width + col;

          const regionRow = offsetY + row;
          const regionCol = offsetX + col;
          const regionIndex = regionRow * regionWidth + regionCol;

          matrix[regionIndex] = tile.elevations[tileIndex];
        }
      }
    });

    return { matrix, width: regionWidth, height: regionHeight };
  }

  // --------------------------------------------
  //  Convert raw terrain tile into elevations
  // --------------------------------------------
  async function fetchTileAsElevations(terrainUrl, x, y) {
    const res = await fetch(terrainUrl);
    if (!res.ok) {
      throw new Error(`Failed fetching tile ${terrainUrl}`);
    }
    const blob = await res.blob();
    const imageBitmap = await createImageBitmap(blob);

    const canvas = document.createElement("canvas");
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imageBitmap, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const elevations = new Float32Array(canvas.width * canvas.height);

    for (let i = 0; i < data.length; i += 4) {
      const R = data[i];
      const G = data[i + 1];
      const B = data[i + 2];
      const idx = i / 4;
      // Convert Mapbox Terrain-RGB to actual elevation
      const elevation = -10000 + (R * 256 * 256 + G * 256 + B) * 0.1;
      elevations[idx] = elevation;
    }

    return {
      x,
      y,
      width: canvas.width,
      height: canvas.height,
      elevations,
    };
  }

  // ---------------------------------------
  //  Colorize tile using global min/max
  // ---------------------------------------
  function colorizeTile(width, height, elevations, globalMin, globalMax) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < elevations.length; i++) {
      const elev = elevations[i];
      let ratio = (elev - globalMin) / (globalMax - globalMin);
      ratio = Math.max(0, Math.min(1, ratio));

      // Simple gradient from lightblue to darkblue
      const start = { r: 230, g: 230, b: 230 }; // lightblue
      const end = { r: 150, g: 150, b: 150 }; // darkblue
      
      const r = Math.round(start.r + (end.r - start.r) * ratio);
      const g = Math.round(start.g + (end.g - start.g) * ratio);
      const b = Math.round(start.b + (end.b - start.b) * ratio);

      const pxIndex = i * 4;
      data[pxIndex + 0] = r;
      data[pxIndex + 1] = g;
      data[pxIndex + 2] = b;
      data[pxIndex + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  }

  // ----------------------------------------------------
  //  Fetch vector tile for water features, in GLOBAL coords
  // ----------------------------------------------------
  async function fetchVectorTileForWater(vectorUrl, tileX, tileY, minX, minY) {
    try {
      const res = await fetch(vectorUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch vector tile ${tileX}/${tileY}`);
      }
      const arrayBuf = await res.arrayBuffer();

      const tile = new VectorTile(new Pbf(arrayBuf));
      const waterLayer = tile.layers["water"];
      if (!waterLayer) {
        return [];
      }

      const paths = [];
      for (let i = 0; i < waterLayer.length; i++) {
        const feature = waterLayer.feature(i);
        const geometry = feature.loadGeometry();
        const type = feature.type; // 3 = polygon
        if (type === 3) {
          const pathD = geometryToSVGPath(geometry, tileX, tileY, minX, minY);
          if (pathD) {
            // Store the fully offset path in a single global coordinate system
            paths.push({ d: pathD });
          }
        }
      }
      return paths;
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  /**
   * Convert the geometry from local tile coords to a single global space,
   * so that x=0,y=0 is the top-left of the entire bounding box.
   */
  const geometryToSVGPath = (geometry, tileX, tileY, minTileX, minTileY) => {
    const extent = 4096;
    const scale = 256 / extent;
    // Offsets to place this tile in the global region
    const offsetX = (tileX - minTileX) * 256;
    const offsetY = (tileY - minTileY) * 256;

    let d = "";
    geometry.forEach((ring) => {
      ring.forEach((point, i) => {
        // Scale from the 4096 tile coordinate to pixel space (0..256)
        const px = point.x * scale + offsetX;
        const py = point.y * scale + offsetY;
        if (i === 0) {
          d += `M${px},${py}`;
        } else {
          d += `L${px},${py}`;
        }
      });
      d += "Z ";
    });
    return d;
  };

  // ----------------------------------------------------
  //  lat/lon <--> tile coordinate helpers
  // ----------------------------------------------------
  function lngLatToTile(lon, lat, zoom) {
    const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
    const y = Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
        ) /
          Math.PI) /
        2) *
        Math.pow(2, zoom)
    );
    return { x, y };
  }

  const renderRegionSVGPreview = () => {
    if (!regionTiles || regionTiles.length === 0) return null;

    const tileXs = regionTiles.map((t) => t.x);
    const tileYs = regionTiles.map((t) => t.y);
    const minX = Math.min(...tileXs);
    const minY = Math.min(...tileYs);
    const maxX = Math.max(...tileXs);
    const maxY = Math.max(...tileYs);

    const widthPx = (maxX - minX + 1) * 256;
    const heightPx = (maxY - minY + 1) * 256;

    // No longer grouping water by tile since they are in global coords
    return (
      <SvgPanZoomWrapper width={600} height={400}>
        <svg width={widthPx} height={heightPx}>
          {/* 1) Render raster images */}
          {regionTiles.map((tile) => {
            const offsetX = (tile.x - minX) * 256;
            const offsetY = (tile.y - minY) * 256;
            return (
              <image
                key={`raster-${tile.x}-${tile.y}`}
                href={tile.imgUrl}
                x={offsetX}
                y={offsetY}
                width={256}
                height={256}
              />
            );
          })}

          {/* 2) Render water polygons directly, already in global coords */}
          <g>
            {regionWater.map((wf, idx) => (
              <path
                key={`water-${idx}`}
                d={wf.d} // 'd' is in global coordinates
                fill='rgb(64, 173, 216)'
                fillOpacity={0.4}
                stroke="none"
              />
            ))}
          </g>
        </svg>
      </SvgPanZoomWrapper>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {/* Map container */}
      <div ref={mapContainer} className={mapContainerStyles} />

      {selectedLngLat && (
        <p className="text-gray-700">
          Selected location: {selectedLngLat.lng.toFixed(4)},{" "}
          {selectedLngLat.lat.toFixed(4)}
        </p>
      )}

      {/* Radius input */}
      <div className="flex items-center space-x-2">
        <label className="font-medium text-gray-600">Radius (km):</label>
        <input
          type="number"
          value={radiusKm}
          onChange={(e) => setRadiusKm(Number(e.target.value))}
          className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none"
        />
      </div>

      {/* Action button */}
      <div className="flex space-x-4">
        <Button disabled={!selectedLngLat} onClick={handleGenerateRegionMap}>
          Generate Region Map (Global Min/Max)
        </Button>
      </div>

      {/*
        Optional: You could still render an SVG preview if you want.
        But notice that 'regionWater' now has global offsets in its path 'd',
        so you do NOT need to transform them again.
      */}

      {/* Show stitched image for reference */}
      {fullRegionImage && (
        <div className="pt-4">
          <h3 className="font-semibold text-gray-700">Full Region Image:</h3>
          {/* <img
            src={fullRegionImage}
            alt="Full Region Terrain Map"
            className="mt-2 border border-gray-300"
            style={{ maxWidth: "100%", height: "auto" }}
          /> */}
          {renderRegionSVGPreview()}
        </div>
      )}

      {/* Debug info about your new elevation matrix */}
      {regionElevationArray && (
        <div className="pt-4 text-gray-800">
          <p>
            <strong>Elevation Matrix:</strong> {regionMatrixWidth} x{" "}
            {regionMatrixHeight}
          </p>
          <p>
            Example cell at center:
            <br />
            {(() => {
              const centerRow = Math.floor(regionMatrixHeight / 2);
              const centerCol = Math.floor(regionMatrixWidth / 2);
              const centerIdx = centerRow * regionMatrixWidth + centerCol;
              const centerElevation = regionElevationArray[centerIdx];
              return centerElevation
                ? centerElevation.toFixed(2) + " m"
                : "No data";
            })()}
          </p>
        </div>
      )}
    </div>
  );
}

export default TopographicMap;
