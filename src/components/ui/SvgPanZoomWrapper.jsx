import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  MousePointer,
  Move,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Maximize,
} from "lucide-react";

const CustomToolbar = ({
  tool,
  setTool,
  handleZoomIn,
  handleZoomOut,
  handleReset,
}) => (
  <div className="flex space-x-2">
    {/* Tools */}
    <button
      onClick={() => setTool("auto")}
      className={`p-2 rounded-md transition-colors inline-flex items-center justify-center
        ${
          tool === "auto"
            ? "bg-blue-500 text-white"
            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
        }`}
      title="Auto Tool"
    >
      <MousePointer className="w-5 h-5" />
    </button>
    <button
      onClick={() => setTool("pan")}
      className={`p-2 rounded-md transition-colors inline-flex items-center justify-center
        ${
          tool === "pan"
            ? "bg-blue-500 text-white"
            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
        }`}
      title="Pan Tool"
    >
      <Move className="w-5 h-5" />
    </button>

    {/* Zoom Controls */}
    <button
      onClick={handleZoomIn}
      className="p-2 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
      title="Zoom In"
    >
      <ZoomInIcon className="w-5 h-5" />
    </button>
    <button
      onClick={handleZoomOut}
      className="p-2 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
      title="Zoom Out"
    >
      <ZoomOutIcon className="w-5 h-5" />
    </button>
    <button
      onClick={handleReset}
      className="p-2 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
      title="Reset View"
    >
      <Maximize className="w-5 h-5" />
    </button>
  </div>
);

/**
 * SvgPanZoomWrapper
 *
 * A reusable pan/zoom wrapper for SVG elements, handling panning and zooming separately.
 *
 * Props:
 * - width (number): Viewer width in px.
 * - height (number): Viewer height in px.
 * - children (ReactNode): Your SVG markup goes here.
 * - onSvgClick (function): Callback called when user clicks inside the wrapper.
 *    Receives (wrapperCoords, svgCoords, nativeEvent).
 */

export default function SvgPanZoomWrapper({
  width = 800,
  height = 400,
  children,
  onSvgClick,
}) {
  const [tool, setTool] = useState("auto");
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);

  // Utility to convert clientX/clientY to un-transformed SVG coords
  const getSvgPoint = useCallback(
    (clientX, clientY) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();

      // "Local" coords inside the wrapper
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;

      // Convert to actual SVG coords by reversing our pan/zoom
      const svgX = (localX - translate.x) / scale;
      const svgY = (localY - translate.y) / scale;

      return { x: svgX, y: svgY };
    },
    [translate, scale]
  );

  const handleMouseDown = (e) => {
    if (tool === "pan") {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      if (containerRef.current) {
        containerRef.current.style.cursor = "grabbing";
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      if (containerRef.current) {
        containerRef.current.style.cursor = tool === "pan" ? "grab" : "default";
      }
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && tool === "pan") {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;

      setTranslate((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));

      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  // Zoom with wheel
  const handleWheel = useCallback(
    (e) => {
      e.preventDefault(); // Prevent default scrolling
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newScale = scale * zoomFactor;
      const newTranslateX = mouseX - (mouseX - translate.x) * zoomFactor;
      const newTranslateY = mouseY - (mouseY - translate.y) * zoomFactor;

      setScale(newScale);
      setTranslate({ x: newTranslateX, y: newTranslateY });
    },
    [scale, translate]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add a non-passive wheel event listener
    const options = { passive: false };
    container.addEventListener("wheel", handleWheel, options);
    return () => {
      container.removeEventListener("wheel", handleWheel, options);
    };
  }, [handleWheel]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor = tool === "pan" ? "grab" : "default";
    }
  }, [tool]);

  // Zoom helpers
  const zoomAtPoint = (x, y, factor) => {
    const newScale = scale * factor;
    const newTranslateX = x - (x - translate.x) * factor;
    const newTranslateY = y - (y - translate.y) * factor;

    setScale(newScale);
    setTranslate({ x: newTranslateX, y: newTranslateY });
  };

  const handleZoomIn = () => {
    zoomAtPoint(width / 2, height / 2, 1.1);
  };

  const handleZoomOut = () => {
    zoomAtPoint(width / 2, height / 2, 0.9);
  };

  const handleReset = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  // **NEW**: Handle click inside the wrapper.
  // We call `onSvgClick` with both wrapper coords and SVG coords.
  const handleClick = useCallback(
    (e) => {
      // Only do something if the user isn't panning.
      if (tool !== "auto") return;

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const wrapperX = e.clientX - rect.left;
        const wrapperY = e.clientY - rect.top;
        const svgCoords = getSvgPoint(e.clientX, e.clientY);

        if (onSvgClick) {
          // Provide both the wrapper coords and the SVG coords
          onSvgClick({ x: wrapperX, y: wrapperY }, svgCoords, e);
        }
      }
    },
    [tool, getSvgPoint, onSvgClick]
  );

  return (
    <div className="relative inline-block" style={{ width, height }}>
      <div
        ref={containerRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
      >
        <svg
          width="100%"
          height="100%"
          style={{
            userSelect: "none",
            background: "#f8f8f8",
            display: "block",
          }}
        >
          <g transform={`translate(${translate.x}, ${translate.y})`}>
            <g transform={`scale(${scale})`}>{children}</g>
          </g>
        </svg>

        {/* The toolbar in the corner */}
        <div className="absolute top-2 right-2 flex flex-col space-y-2 p-2 bg-gray-800 bg-opacity-80 rounded-md shadow-md">
          <CustomToolbar
            tool={tool}
            setTool={setTool}
            handleZoomIn={handleZoomIn}
            handleZoomOut={handleZoomOut}
            handleReset={handleReset}
          />
        </div>
      </div>
    </div>
  );
}
