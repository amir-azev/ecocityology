import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const SystemGraph = () => {
    const svgRef = useRef();

    useEffect(() => {
        const width = 600;
        const height = 400;

        // Sample graph data
        const data = {
            nodes: [
                { id: "Node 1" },
                { id: "Node 2" },
                { id: "Node 3" },
                { id: "Node 4" },
                { id: "Node 5" },
            ],
            links: [
                { source: "Node 1", target: "Node 2" },
                { source: "Node 2", target: "Node 3" },
                { source: "Node 3", target: "Node 4" },
                { source: "Node 4", target: "Node 5" },
                { source: "Node 5", target: "Node 1" },
            ],
        };

        // Clear any previous SVG content
        d3.select(svgRef.current).selectAll("*").remove();

        // Create an SVG element
        const svg = d3.select(svgRef.current)
            .attr("width", width)
            .attr("height", height);

        // Initialize force simulation
        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));

        // Draw links
        const link = svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(data.links)
            .enter()
            .append("line")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .attr("stroke-width", 1.5);

        // Draw nodes
        const node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(data.nodes)
            .enter()
            .append("circle")
            .attr("r", 8)
            .attr("fill", "#69b3a2")
            .call(drag(simulation));

        // Add labels
        const label = svg.append("g")
            .attr("class", "labels")
            .selectAll("text")
            .data(data.nodes)
            .enter()
            .append("text")
            .attr("dy", -10)
            .attr("text-anchor", "middle")
            .text(d => d.id);

        // Update positions on each simulation tick
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);

            label
                .attr("x", d => d.x)
                .attr("y", d => d.y);
        });

        // Drag functionality
        function drag(simulation) {
            function dragstarted(event, d) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            }

            function dragged(event, d) {
                d.fx = event.x;
                d.fy = event.y;
            }

            function dragended(event, d) {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }

            return d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended);
        }

    }, []);

    return <svg ref={svgRef}></svg>;
};

export default SystemGraph;
