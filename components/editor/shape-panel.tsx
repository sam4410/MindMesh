import { Panel } from "@xyflow/react";
import {
  Circle,
  Cylinder,
  Diamond,
  Hexagon,
  Pill,
  RectangleHorizontal,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SHAPE_DRAG_TYPE, shapeDragPayload } from "@/lib/canvas-shapes";
import { NODE_SHAPES, type NodeShape } from "@/types/canvas";

const SHAPE_ICONS: Record<NodeShape, LucideIcon> = {
  rectangle: RectangleHorizontal,
  diamond: Diamond,
  circle: Circle,
  pill: Pill,
  cylinder: Cylinder,
  hexagon: Hexagon,
};

// Rendered inside <ReactFlow>, so React Flow's Panel pins it to the bottom-center of the canvas.
export function ShapePanel() {
  return (
    <Panel
      position="bottom-center"
      role="toolbar"
      aria-label="Shapes"
      className="flex items-center gap-1 rounded-full border border-surface-border bg-surface/90 p-1.5 backdrop-blur"
    >
      {NODE_SHAPES.map((shape) => {
        const Icon = SHAPE_ICONS[shape];
        return (
          <Button
            key={shape}
            variant="ghost"
            size="icon"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(SHAPE_DRAG_TYPE, JSON.stringify(shapeDragPayload(shape)));
              event.dataTransfer.effectAllowed = "copy";
            }}
            title={`Drag a ${shape} onto the canvas`}
            aria-label={`${shape} shape`}
            className="cursor-grab rounded-full text-copy-muted hover:text-copy-primary active:cursor-grabbing"
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </Panel>
  );
}
