import { Panel, useStore } from "@xyflow/react";
import {
  Circle,
  Cylinder,
  Diamond,
  Hexagon,
  Pill,
  RectangleHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useRef } from "react";

import { ShapeGraphic } from "@/components/editor/shape-graphic";
import { Button } from "@/components/ui/button";
import { SHAPE_DRAG_TYPE, SHAPE_SIZES, shapeDragPayload } from "@/lib/canvas-shapes";
import { DEFAULT_NODE_COLOR, NODE_SHAPES, type NodeShape } from "@/types/canvas";

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
  const zoom = useStore((state) => state.transform[2]);
  const previews = useRef<Partial<Record<NodeShape, HTMLDivElement | null>>>({});

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
              // The browser keeps the ghost on the cursor and removes it on drop or cancel.
              // Centered, because the drop centers the new node on the cursor.
              const preview = previews.current[shape];
              if (preview) {
                event.dataTransfer.setDragImage(preview, preview.offsetWidth / 2, preview.offsetHeight / 2);
              }
            }}
            title={`Drag a ${shape} onto the canvas`}
            aria-label={`${shape} shape`}
            className="cursor-grab rounded-full text-copy-muted hover:text-copy-primary active:cursor-grabbing"
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}

      {/* Drag images must already be rendered when a drag starts, so they wait off-screen,
          sized to the node a drop would create at the current zoom. */}
      <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]">
        {NODE_SHAPES.map((shape) => (
          <div
            key={shape}
            ref={(element) => {
              previews.current[shape] = element;
            }}
            data-shape-preview={shape}
            className="relative"
            style={{ width: SHAPE_SIZES[shape].width * zoom, height: SHAPE_SIZES[shape].height * zoom }}
          >
            <ShapeGraphic shape={shape} color={DEFAULT_NODE_COLOR} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
