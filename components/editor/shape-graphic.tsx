import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { NodeShape } from "@/types/canvas";

// Shapes CSS can't draw are inline SVGs on a 100×100 box, stretched to the node size.
// Non-scaling strokes keep the outline 1px whatever the stretch or zoom.
const SVG_SHAPES: Partial<Record<NodeShape, ReactNode>> = {
  diamond: <polygon points="50,0 100,50 50,100 0,50" vectorEffect="non-scaling-stroke" />,
  hexagon: <polygon points="25,0 75,0 100,50 75,100 25,100 0,50" vectorEffect="non-scaling-stroke" />,
  cylinder: (
    <>
      <path d="M0,10 A50,10 0 0,1 100,10 V90 A50,10 0 0,1 0,90 Z" vectorEffect="non-scaling-stroke" />
      {/* Front rim of the top ellipse. */}
      <path d="M0,10 A50,10 0 0,0 100,10" fill="none" vectorEffect="non-scaling-stroke" />
    </>
  ),
};

interface ShapeGraphicProps {
  shape: NodeShape;
  color: string;
  selected?: boolean;
}

// Fills its positioned parent; shared by canvas nodes and the drag preview so both look the same.
export function ShapeGraphic({ shape, color, selected = false }: ShapeGraphicProps) {
  const svgShape = SVG_SHAPES[shape];

  if (svgShape) {
    return (
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ fill: color }}
        className={cn(
          "absolute inset-0 h-full w-full overflow-visible",
          selected ? "stroke-brand" : "stroke-surface-border-subtle"
        )}
      >
        {svgShape}
      </svg>
    );
  }

  return (
    <div
      aria-hidden
      style={{ backgroundColor: color }}
      className={cn(
        "absolute inset-0 border",
        shape === "rectangle" ? "rounded-xl" : "rounded-full",
        selected ? "border-brand" : "border-surface-border-subtle"
      )}
    />
  );
}
