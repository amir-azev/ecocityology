import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";

// Child components
import TopographicMap from "./components/pages/cityGenerator/TopographicMap";
import CityGenerator from "./components/pages/cityGenerator/CityGenerator";
import CellGrowthSimulator from "./components/pages/cityGenerator/CellGrowth";
import { Grid } from "lucide-react";
import GridLayout from "./components/pages/cityGenerator/GridLayout";
import RenderCity from "./components/pages/renderCity/RenderCity";
import { generateCityGraph } from "./components/graphGenerator";
import RoadLayouts from "./components/pages/cityGenerator/RoadLayouts";

export default function App() {
  // City area state
  const [cityArea, setCityArea] = useState(2500);
  const [activeTab, setActiveTab] = useState("TopographicMap");

  // Generate graph data dynamically based on city area
  const { nodes, links } = generateCityGraph(cityArea);

  /**
   * 1) State for the topographic map
   */
  const [selectedLngLat, setSelectedLngLat] = useState(null);
  const [radiusKm, setRadiusKm] = useState(1);
  const [regionTiles, setRegionTiles] = useState([]);
  const [regionWater, setRegionWater] = useState([]);
  const [fullRegionImage, setFullRegionImage] = useState(null);
  const [regionElevationArray, setregionElevationArray] = useState(null);
  const [regionMatrixWidth, setRegionMatrixWidth] = useState(0);
  const [regionMatrixHeight, setRegionMatrixHeight] = useState(0);
  const [regionWaterPaths, setRegionWaterPaths] = useState(null);
  const [simulatedShapes, setSimulatedShapes] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [roads, setRoads] = useState([]);

  /**
   * 2) State for region plotter (force graph)
   */
  const [plotterNodes, setPlotterNodes] = useState(nodes);
  const [plotterLinks, setPlotterLinks] = useState(links);

  /**
   * 3) State for the cell growth simulator
   */
  const [cityShapes, setCityShapes] = useState([]);

  return (
    <div className="w-full h-screen p-6">
      {/* Title Section */}
      <header className="bg-[#94d194] text-white p-4 text-center rounded-md mb-5">
        <h1 className="text-3xl font-bold">Ecotopia - The City of the Future, Built by Robots</h1>
      </header>

      {/* Tabs Navigation */}
      <Tabs
        defaultValue="TopographicMap"
        onValueChange={(value) => setActiveTab(value)}
        className="w-full h-full"
      >
        <TabsList className="w-full flex justify-around border-b">
          <TabsTrigger value="TopographicMap" className="w-full text-center py-2">
            1. Select Location
          </TabsTrigger>
          <TabsTrigger value="CityGrow" className="w-full text-center py-2">
            2. Set Regions
          </TabsTrigger>
          <TabsTrigger value="CellGrowthSimulator" className="w-full text-center py-2">
            3. Regions Grow
          </TabsTrigger>
          <TabsTrigger value="RoadLayouts" className="w-full text-center py-2">
            4. Layout Roads
          </TabsTrigger>
          <TabsTrigger value="Render" className="w-full text-center py-2">
            5. 3D Render
          </TabsTrigger>
        </TabsList>

        {/* Show slider only in the "CityGrow" tab */}
        {activeTab === "CityGrow" && (
          <div className="flex items-center space-x-4 p-4 border-b">
            <span className="text-lg font-medium">City Area: {cityArea*(1/500)} km²</span>
            <Slider
              value={[cityArea]}
              onValueChange={(value) => {
                setCityArea(value[0]);
                const { nodes, links } = generateCityGraph(value[0]);
                setPlotterNodes(nodes);
                setPlotterLinks(links);
              }}
              min={1000}
              max={10000}
              step={100}
              className="w-1/2"
            />
          </div>
        )}

        {/* TAB 1: Topographic Map */}
        <TabsContent value="TopographicMap" className="p-4 h-full w-full">
          <TopographicMap
            selectedLngLat={selectedLngLat}
            setSelectedLngLat={setSelectedLngLat}
            radiusKm={radiusKm}
            setRadiusKm={setRadiusKm}
            regionTiles={regionTiles}
            setRegionTiles={setRegionTiles}
            regionWater={regionWater}
            setRegionWater={setRegionWater}
            regionElevationArray={regionElevationArray}
            setregionElevationArray={setregionElevationArray}
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
        <TabsContent value="CityGrow" className="p-4 h-full w-full">
          <CityGenerator
            plotterNodes={plotterNodes}
            setPlotterNodes={setPlotterNodes}
            plotterLinks={plotterLinks}
            setPlotterLinks={setPlotterLinks}
            fullRegionImage={fullRegionImage}
            regionWater={regionWater}
            selectedLngLat={selectedLngLat}
            radiusKm={radiusKm}
            regionElevationArray={regionElevationArray}
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
            regionElevationArray={regionElevationArray}
            regionMatrixWidth={regionMatrixWidth}
            regionMatrixHeight={regionMatrixHeight}
            regionWaterPaths={regionWaterPaths}
            simulatedShapes={simulatedShapes}
            setSimulatedShapes={setSimulatedShapes}
          />
        </TabsContent>

        {/* TAB 4: Road Layouts */}
        <TabsContent value="RoadLayouts" className="p-4">
          <RoadLayouts
            cityShapes={cityShapes}
            setCityShapes={setCityShapes}
            regionWater={regionWater}
            fullRegionImage={fullRegionImage}
            regionElevationArray={regionElevationArray}
            regionMatrixWidth={regionMatrixWidth}
            regionMatrixHeight={regionMatrixHeight}
            regionWaterPaths={regionWaterPaths}
            simulatedShapes={simulatedShapes}
            setSimulatedShapes={setSimulatedShapes}
            buildings={buildings}
            setBuildings={setBuildings}
            roads={roads}
            setRoads={setRoads}
          />
        </TabsContent>

        {/* TAB 5: 3D Render */}
        <TabsContent value="Render" className="p-4">
          <RenderCity
            regionElevationArray={regionElevationArray}
            regionMatrixWidth={regionMatrixWidth}
            regionMatrixHeight={regionMatrixHeight}
            elevationScale={0.05}
            regionWater={regionWater}
            data={[]}
            elevationMatrix={[]}
            simulatedShapes={simulatedShapes}
            buildings={buildings}
            roads={roads}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
