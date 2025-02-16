// RegionPlotter.jsx

import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { Button } from "@/components/ui/button";
import SvgPanZoomWrapper from "@/components/ui/SvgPanZoomWrapper";

function RegionPlotter({
  plotterNodes,
  plotterLinks,
  regionWater,
  setCityShapes,
  fullRegionImage,
  regionMatrixWidth,
  regionMatrixHeight,
}) {
  const groupRef = useRef(null);
  const simulationRef = useRef(null);

  const [isPaused, setIsPaused] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  // Slider to adjust the visualization scale
  const [scaleFactor, setScaleFactor] = useState(1.0);

  // Ref to keep track of pause state in drag handlers
  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // State to store terrain dimensions based on the merged image
  const [terrainSize, setTerrainSize] = useState({
    width: regionMatrixWidth || 800,
    height: regionMatrixHeight || 600,
  });

  // Effect to set terrainSize based on regionMatrixWidth and regionMatrixHeight
  useEffect(() => {
    if (regionMatrixWidth && regionMatrixHeight) {
      setTerrainSize({
        width: regionMatrixWidth,
        height: regionMatrixHeight,
      });
    }
  }, [regionMatrixWidth, regionMatrixHeight]);

  /**
   * Setup the D3 force simulation
   */
  useEffect(() => {
    if (!plotterNodes || plotterNodes.length === 0) return;

    const group = d3.select(groupRef.current);
    group.selectAll("*").remove(); // Clear existing elements

    const { width, height } = terrainSize;

    // Background rectangle to clear node selection on click
    group
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("click", () => setSelectedNode(null));

    // Color scale for edge weights
    const colorScale = d3.scaleLinear().domain([-5, 5]).range(["red", "green"]);

    // Initialize force simulation
    const simulation = d3
      .forceSimulation(plotterNodes)
      .force(
        "link",
        d3
          .forceLink(plotterLinks)
          .id((d) => d.id)
          .strength((link) => Math.abs(link.weight) / 100)
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d) => Math.sqrt(d.startingShapeArea) + 5)
      );

    // Store simulation reference
    simulationRef.current = simulation;

    // Custom repulsion for negative links
    simulation.force("repulsiveLinks", function (alpha) {
      plotterLinks.forEach((link) => {
        if (link.weight < 0) {
          const source =
            typeof link.source === "object"
              ? link.source
              : plotterNodes.find((node) => node.id === link.source);
          const target =
            typeof link.target === "object"
              ? link.target
              : plotterNodes.find((node) => node.id === link.target);

          if (!source || !target) return;

          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (Math.abs(link.weight) / distance) * alpha * 1000;

          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          // Apply repulsive force
          source.vx -= fx;
          source.vy -= fy;
          target.vx += fx;
          target.vy += fy;
        }
      });
    });

    // Draw edges
    const linkSelection = group
      .selectAll(".link")
      .data(plotterLinks)
      .enter()
      .append("line")
      .attr("class", "link")
      .style("stroke", (d) => colorScale(d.weight))
      .style("stroke-width", (d) => Math.abs(d.weight));

    // Node groups
    const nodeGroups = group
      .selectAll(".node-group")
      .data(plotterNodes)
      .enter()
      .append("g")
      .attr("class", "node-group")
      .call(drag(simulation))
      .on("click", (event, d) => {
        setSelectedNode(d);
        event.stopPropagation();
      });

    // Circles representing nodes with color attribute
    nodeGroups
      .append("circle")
      .attr("class", "node")
      .attr("r", (d) => Math.sqrt(d.startingShapeArea)) // Radius based on startingShapeArea
      .style("fill", (d) => d.color) // Use the color attribute
      .style("stroke", "#fff")
      .style("stroke-width", 1.5);

    // Labels for nodes
    nodeGroups
      .append("text")
      .attr("class", "label")
      .attr("dy", ".35em")
      .style("text-anchor", "middle")
      .style("font-size", "10px")
      .style("user-select", "none")
      .style("pointer-events", "none")
      .text((d) => d.id);

    // Update positions on each simulation tick
    simulation.on("tick", () => {
      linkSelection
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      nodeGroups.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // Drag handlers
    function drag(simulation) {
      function dragstarted(event, d) {
        if (!event.active && !isPausedRef.current) {
          simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
        if (isPausedRef.current) {
          d.x = event.x;
          d.y = event.y;
          d3.select(this).attr("transform", `translate(${d.x},${d.y})`);
          linkSelection
            .attr("x1", (l) => l.source.x)
            .attr("y1", (l) => l.source.y)
            .attr("x2", (l) => l.target.x)
            .attr("y2", (l) => l.target.y);
        }
      }

      function dragended(event, d) {
        if (!event.active && !isPausedRef.current) {
          simulation.alphaTarget(0);
        }
        if (!d.isFixed) {
          d.fx = null;
          d.fy = null;
        }
      }

      return d3
        .drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    // Cleanup on unmount
    return () => {
      simulation.stop();
    };
  }, [plotterNodes, plotterLinks, selectedNode, terrainSize]);

  /**
   * Update node styles when selectedNode changes
   */
  useEffect(() => {
    const group = d3.select(groupRef.current);
    group
      .selectAll(".node")
      .style("fill", (d) =>
        d.isFixed ? "orange" : d.id === selectedNode?.id ? "red" : d.color
      )
      .style("stroke", (d) => (d.isFixed ? "black" : "#fff"))
      .style("stroke-width", (d) => (d.isFixed ? 3 : 1.5));
  }, [selectedNode]);

  /**
   * Pause or resume the simulation
   */
  useEffect(() => {
    if (simulationRef.current) {
      if (isPaused) simulationRef.current.stop();
      else simulationRef.current.alpha(0.3).restart();
    }
  }, [isPaused]);

  /**
   * Toggle node fixation (anchor/unanchor)
   */
  const toggleNodeFixed = (node) => {
    node.isFixed = !node.isFixed;
    if (node.isFixed) {
      node.fx = node.x;
      node.fy = node.y;
    } else {
      node.fx = null;
      node.fy = null;
    }
    setSelectedNode({ ...node });
  };

  /**
   * Generate circular shapes for each node and set them as city shapes
   */
  const handleSetRegions = () => {
    if (!plotterNodes) return;

    const newShapes = plotterNodes.map((node) => {
      const { x, y, maxShapeArea, growthRate } = node;
      const radius = Math.sqrt(node.startingShapeArea);

      // Approximate the circle as a polygon with sufficient points
      const numPoints = 32;
      const angleStep = (2 * Math.PI) / numPoints;
      const outerPolygon = Array.from({ length: numPoints }, (_, i) => [
        x + radius * Math.cos(i * angleStep),
        y + radius * Math.sin(i * angleStep),
      ]);

      return {
        outerPolygon, // Approximated circle as polygon
        holes: [],
        isObstacle: false, // Adjust as needed
        maxShapeArea, // Include maxShapeArea
        growthRate, // Include growthRate
      };
    });

    // Pass the new shapes to the parent component
    setCityShapes(newShapes);
    console.log(newShapes);
  };

  /**
   * Render the terrain map and water polygons using the merged image
   */
  const renderTerrainBackground = () => {
    if (!fullRegionImage) return null;

    const { width, height } = terrainSize;

    return (
      <g>
        {/* 1) Render the full stitched image */}
        <image
          href={fullRegionImage}
          x={0}
          y={0}
          width={width}
          height={height}
        />

        {/* 2) Render water polygons (already in global coordinates) */}
        {regionWater.map((wf, idx) => (
          <path
            key={`water-${idx}`}
            d={wf.d} // 'd' is in global coordinates
            fill="#0000ff"
            fillOpacity={0.4}
            stroke="none"
          />
        ))}
      </g>
    );
  };

  /**
   * Define a scaling transformation centered on the terrain
   */
  const { width, height } = terrainSize;
  const centerX = width / 2;
  const centerY = height / 2;
  const scaleTransform = `
    translate(${centerX}, ${centerY})
    scale(${scaleFactor})
    translate(${-centerX}, ${-centerY})
  `;

  return (
    <div className="w-full h-full">
      {/* Slider to control scale */}
      <div className="mb-2 flex items-center space-x-2">
        <label htmlFor="scaleSlider" className="font-medium text-gray-600">
          Scale:
        </label>
        <input
          id="scaleSlider"
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={scaleFactor}
          onChange={(e) => setScaleFactor(Number(e.target.value))}
          className="w-48"
        />
        <span>{scaleFactor.toFixed(1)}x</span>
      </div>

      {/* Pause / Resume Button */}
      <div className="mb-2">
        <Button onClick={() => setIsPaused(!isPaused)}>
          {isPaused ? "Play" : "Pause"}
        </Button>

        {/* Button to generate circular shapes for nodes */}
        <Button
          className="ml-2"
          onClick={handleSetRegions}
          disabled={!plotterNodes || plotterNodes.length === 0}
        >
          Set Regions
        </Button>
      </div>

      <div className="w-full h-full relative">
        <SvgPanZoomWrapper width={"100%"} height={"100%"}>
          <svg
            width={width}
            height={height}
            style={{ backgroundColor: "#eee" }}
          >
            {/* Terrain and water polygons */}
            {renderTerrainBackground()}

            {/* Apply scaling to the visualization */}
            <g transform={scaleTransform} ref={groupRef} />
          </svg>
        </SvgPanZoomWrapper>

        {/* Button to toggle node fixation, positioned near the selected node */}
        {selectedNode && (
          <Button
            style={{
              position: "absolute",
              left: `${selectedNode.x * scaleFactor + 15}px`,
              top: `${selectedNode.y * scaleFactor - 10}px`,
            }}
            onClick={() => toggleNodeFixed(selectedNode)}
          >
            {selectedNode.isFixed ? "Unanchor" : "Anchor"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default RegionPlotter;
