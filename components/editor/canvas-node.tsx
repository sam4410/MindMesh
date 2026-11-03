import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useState } from "react";

import { NodeColorToolbar } from "@/components/editor/node-color-toolbar";
import { ShapeGraphic } from "@/components/editor/shape-graphic";
import { MIN_NODE_SIZE } from "@/lib/canvas-shapes";
import { cn } from "@/lib/utils";
import { DEFAULT_NODE_TEXT_COLOR, type CanvasEdge, type CanvasNode } from "@/types/canvas";

const LABEL_PLACEHOLDER = "Add label";
const HANDLE_POSITIONS = [Position.Top, Position.Right, Position.Bottom, Position.Left];

export function CanvasNodeView({ id, data, selected }: NodeProps<CanvasNode>) {
  // Resize, label and color changes all go through onNodesChange, which syncs them via Liveblocks.
  const { updateNodeData } = useReactFlow<CanvasNode, CanvasEdge>();
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div
      style={{ color: data.textColor ?? DEFAULT_NODE_TEXT_COLOR }}
      // group: hovering the node fades its connection handles in.
      className="group relative flex h-full w-full items-center justify-center text-center text-sm"
    >
      <NodeColorToolbar
        activeFill={data.color}
        onSelect={({ fill, text }) => updateNodeData(id, { color: fill, textColor: text })}
      />
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_NODE_SIZE.width}
        minHeight={MIN_NODE_SIZE.height}
        lineClassName="border-brand/30!"
        handleClassName="h-2! w-2! rounded-sm! border-brand! bg-base!"
      />
      <ShapeGraphic shape={data.shape} color={data.color} selected={selected} />
      {/* After the shape so it doesn't paint over the inner half of each handle.
          All handles are sources; loose connection mode lets any handle connect to any other. */}
      {HANDLE_POSITIONS.map((position) => (
        <Handle
          key={position}
          id={position}
          type="source"
          position={position}
          className="h-2! w-2! border-(--bg-base)! bg-copy-primary! opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        />
      ))}

      {/* The text (or placeholder) always sizes this box and only turns invisible while the
          textarea sits on top of it, so opening the editor and typing never shift the layout. */}
      <div
        className={cn("relative max-w-full px-4", isEditing && "nodrag nopan")}
        onDoubleClick={() => setIsEditing(true)}
      >
        <span
          className={cn(
            "block whitespace-pre-wrap break-words",
            !data.label && "text-copy-faint",
            isEditing && "invisible"
          )}
        >
          {data.label || LABEL_PLACEHOLDER}
          {/* A trailing newline gets no line box of its own; this keeps the new line's height. */}
          {data.label.endsWith("\n") && "​"}
        </span>
        {isEditing && (
          <textarea
            autoFocus
            aria-label="Node label"
            value={data.label}
            placeholder={LABEL_PLACEHOLDER}
            onFocus={(event) => {
              const end = event.currentTarget.value.length;
              event.currentTarget.setSelectionRange(end, end);
            }}
            onChange={(event) => updateNodeData(id, { label: event.target.value })}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setIsEditing(false);
            }}
            // nodrag/nopan/nowheel: selecting text or scrolling must not move the node or canvas.
            className="nodrag nopan nowheel absolute inset-0 resize-none overflow-hidden bg-transparent px-4 text-center outline-none placeholder:text-copy-faint"
          />
        )}
      </div>
    </div>
  );
}
