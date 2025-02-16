import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Child components
import TopographicMap from "./components/pages/regionPlotter/TopographicMap";
import RegionPlotter from "./components/pages/regionPlotter/RegionPlotter";
import CellGrowthSimulator from "./components/pages/regionPlotter/CellGrowth";
import { Grid } from "lucide-react";
import GridLayout from "./components/pages/regionPlotter/GridLayout";
import RenderCity from "./components/pages/renderCity/RenderCity"

export default function App() {
  /**
   * 1) State for the topographic map
   */
  const [selectedLngLat, setSelectedLngLat] = useState(null);
  const [radiusKm, setRadiusKm] = useState(1);

  // The array of tiles (with colorized elevations) covering the selected region
  const [regionTiles, setRegionTiles] = useState([]);

  // The array of water polygon features for the selected region
  const [regionWater, setRegionWater] = useState([]);

  const [fullRegionImage, setFullRegionImage] = useState(null);

  // [ADDED] Store the stitched elevation matrix for the entire region
  const [regionElevationMatrix, setRegionElevationMatrix] = useState(null);
  const [regionMatrixWidth, setRegionMatrixWidth] = useState(0);
  const [regionMatrixHeight, setRegionMatrixHeight] = useState(0);

  const [regionWaterPaths, setRegionWaterPaths] = useState(null);
  const [simulatedShapes, setSimulatedShapes] = useState([]);

  /**
   * 2) State for region plotter (force graph)
   * If your RegionPlotter uses a static set of nodes and links, you can
   * store them in that component. If you want them editable at runtime (to save or share),
   * you can store them here and pass down as props.
   */
  // Example: store dynamic node/link data

const nodes = [
  {
    id: "Residential",
    growthRate: 1.6,
    startingShapeArea: 320,
    maxShapeArea: 7500,
    color: "#1f77b4", // Blue
  },
  {
    id: "Town Centre",
    growthRate: 1.5,
    startingShapeArea: 300,
    maxShapeArea: 8000,
    color: "#ff7f0e", // Orange
  },
  {
    id: "Market",
    growthRate: 1.4,
    startingShapeArea: 280,
    maxShapeArea: 8200,
    color: "#2ca02c", // Green
  },
  {
    id: "Commercial",
    growthRate: 1.7,
    startingShapeArea: 310,
    maxShapeArea: 7800,
    color: "#d62728", // Red
  },
  {
    id: "Industrial",
    growthRate: 1.3,
    startingShapeArea: 290,
    maxShapeArea: 8300,
    color: "#9467bd", // Purple
  },
  {
    id: "Park A",
    growthRate: 1.2,
    startingShapeArea: 150,
    maxShapeArea: 4000,
    color: "#2ca02c", // Green
  },
  {
    id: "Park B",
    growthRate: 1.1,
    startingShapeArea: 160,
    maxShapeArea: 4500,
    color: "#2ca02c", // Green
  },
];



const links = [
  // Existing Links
  { source: "Residential", target: "Town Centre", weight: 5 },
  { source: "Residential", target: "Market", weight: 3 },
  { source: "Residential", target: "Commercial", weight: 4 },
  { source: "Residential", target: "Industrial", weight: -2 },

  { source: "Town Centre", target: "Market", weight: 4 },
  { source: "Town Centre", target: "Commercial", weight: 5 },
  { source: "Town Centre", target: "Industrial", weight: 2 },

  { source: "Market", target: "Commercial", weight: 3 },
  { source: "Market", target: "Industrial", weight: 1 },

  { source: "Commercial", target: "Industrial", weight: 3 },

  // New Links for Parks
  { source: "Park A", target: "Residential", weight: 4 },
  { source: "Park A", target: "Commercial", weight: 3 },

  { source: "Park B", target: "Residential", weight: 3 },
  { source: "Park B", target: "Commercial", weight: 2 },
];




  const [plotterNodes, setPlotterNodes] = useState(nodes);
  const [plotterLinks, setPlotterLinks] = useState(links);

  /**
   * 3) State for the cell growth simulator
   * This might include shapes representing city regions (or partial growth expansions),
   * as well as obstacles or holes. If you want to treat water polygons as obstacles,
   * you can pass regionWater to the simulator as well.
   */
  const [cityShapes, setCityShapes] = useState([]); // Data structure for shapes in CellGrowth

  return (
    <div className="w-full h-screen">
      <Tabs defaultValue="TopographicMap" className="w-full h-full">
        <TabsList className="w-full flex justify-around border-b">
          <TabsTrigger
            value="TopographicMap"
            className="w-full text-center py-2"
          >
            1. Select Location
          </TabsTrigger>
          <TabsTrigger
            value="CityGrow"
            className="w-full text-center py-2"
          >
            2. Grow City
          </TabsTrigger>

          <TabsTrigger value="Render" className="w-full text-center py-2">
            4. 3D Render
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Topographic Map */}
        <TabsContent value="TopographicMap" className="p-4 h-full w-full">
          <TopographicMap
            // Pass location & radius
            selectedLngLat={selectedLngLat}
            setSelectedLngLat={setSelectedLngLat}
            radiusKm={radiusKm}
            setRadiusKm={setRadiusKm}
            // Pass terrain & water data
            regionTiles={regionTiles}
            setRegionTiles={setRegionTiles}
            regionWater={regionWater}
            setRegionWater={setRegionWater}
            regionElevationMatrix={regionElevationMatrix}
            setRegionElevationMatrix={setRegionElevationMatrix}
            regionMatrixWidth={regionMatrixWidth}
            setRegionMatrixWidth={setRegionMatrixWidth}
            regionMatrixHeight={regionMatrixHeight}
            setRegionMatrixHeight={setRegionMatrixHeight}
            fullRegionImage={fullRegionImage}
            setFullRegionImage={setFullRegionImage}
            setRegionWaterPaths={setRegionWaterPaths}
          />
        </TabsContent>

        {/* TAB 2: Region Plotter */}
        <TabsContent value="CityGrow" className="p-4  h-full w-full">
          <RegionPlotter
            // Example of passing the node/link data if you want them in parent state
            plotterNodes={plotterNodes}
            setPlotterNodes={setPlotterNodes}
            plotterLinks={plotterLinks}
            setPlotterLinks={setPlotterLinks}
            // Optionally pass region or water info if you need an overlay
            fullRegionImage={fullRegionImage}
            regionWater={regionWater}
            // If you want the user to place nodes within the circle:
            selectedLngLat={selectedLngLat}
            radiusKm={radiusKm}
            setCityShapes={setCityShapes}
            regionMatrixWidth={regionMatrixWidth}
            regionMatrixHeight={regionMatrixHeight}
          />
        </TabsContent>

        {/* TAB 3: Cell Growth Simulator */}
        <TabsContent value="CellGrowthSimulator" className="p-4">
          <CellGrowthSimulator
            cityShapes={cityShapes}
            setCityShapes={setCityShapes}
            regionWater={regionWater}
            fullRegionImage={fullRegionImage}
            regionElevationMatrix={regionElevationMatrix}
            regionMatrixWidth={regionMatrixWidth}
            regionMatrixHeight={regionMatrixHeight}
            regionWaterPaths={regionWaterPaths}
            // simulatedShapes = {simulatedShapes}
            setSimulatedShapes={setSimulatedShapes}
          />
        </TabsContent>
        <TabsContent value="Render" className="p-4">
        <RenderCity 
regionElevationMatrix={regionElevationMatrix}
setRegionElevationMatrix={setRegionElevationMatrix}
regionMatrixWidth={regionMatrixWidth}
fullRegionImage={fullRegionImage}
regionWater={regionWater}

        />
        </TabsContent>
      </Tabs>
    </div>
  );
}
