import React, { useState } from "react";
import { Slider } from "@/components/ui/slider"

const GridLayout = ({ boxWidth = 400, boxHeight = 400 }) => {
  const [gridDensity, setGridDensity] = useState(10);
  const [gridAngle, setGridAngle] = useState(0);

  const generateGrid = () => {
    const lines = [];
    const spacing = boxWidth / gridDensity;

    for (let i = 0; i <= gridDensity; i++) {
      const offset = i * spacing;

      lines.push(
        <line
          key={`v-${i}`}
          x1={offset}
          y1={0}
          x2={offset}
          y2={boxHeight}
          stroke="black"
        />
      );

      lines.push(
        <line
          key={`h-${i}`}
          x1={0}
          y1={offset}
          x2={boxWidth}
          y2={offset}
          stroke="black"
        />
      );
    }

    return lines;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full flex flex-col gap-2">
        <label className="font-medium">Grid Density: {gridDensity}</label>
        <Slider
          value={[gridDensity]}
          onValueChange={(value) => setGridDensity(value[0])}
          min={5}
          max={50}
          step={1}
        />
      </div>

      <div className="w-full flex flex-col gap-2">
        <label className="font-medium">Grid Angle: {gridAngle}°</label>
        <Slider
          value={[gridAngle]}
          onValueChange={(value) => setGridAngle(value[0])}
          min={-45}
          max={45}
          step={1}
        />
      </div>

      <div
        className="relative border border-gray-300"
        style={{ width: boxWidth, height: boxHeight }}
      >
        <svg
          width={boxWidth}
          height={boxHeight}
          style={{
            transform: `rotate(${gridAngle}deg)`,
          }}
        >
          {generateGrid()}
        </svg>
      </div>
    </div>
  );
};

export default GridLayout;
