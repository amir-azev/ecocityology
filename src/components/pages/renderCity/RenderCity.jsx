import React, { useRef, useEffect } from "react";

const GridLayout = ({
  regionWater,
  fullRegionImage,
  boxWidth = 600, // Default width if not provided
  boxHeight = 400, // Default height if not provided
}) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!fullRegionImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Create an image object to draw the full region image on the canvas
    const img = new Image();
    img.src = fullRegionImage;
    img.onload = () => {
      // Draw the full region image
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
      ctx.drawImage(img, 0, 0, boxWidth, boxHeight);

      // Render water polygons on top of the image
      if (regionWater) {
        regionWater.forEach((water) => {
          // Begin a new path for each water polygon
          ctx.beginPath();
          const path = new Path2D(water.d); // Assuming water.d is the path data
          ctx.fillStyle = "rgba(0, 0, 255, 0.4)"; // Semi-transparent blue
          ctx.fill(path); // Fill the path with blue color
        });
      }
    };
  }, [fullRegionImage, regionWater, boxWidth, boxHeight]);

  // Access the canvas via the ref and return its image data or manipulate it
  const getRenderedImageData = () => {
    const canvas = canvasRef.current;
    return canvas ? canvas.toDataURL() : null; // Return image data in base64 format
  };

  return (
    <div
      className="relative border border-gray-300"
      style={{
        width: `${boxWidth}px`,
        height: `${boxHeight}px`,
        overflow: "hidden",
        backgroundColor: "#eee",
        position: "relative",
      }}
    >
      {/* Canvas where the image and polygons are rendered */}
      <canvas
        ref={canvasRef}
        width={boxWidth}
        height={boxHeight}
        style={{ display: "block" }}
      />
      
      {/* Optional: Button to log or use rendered image data */}
      <button onClick={() => console.log(getRenderedImageData())}>
        Log Rendered Image Data
      </button>
    </div>
  );
};

export default GridLayout;
