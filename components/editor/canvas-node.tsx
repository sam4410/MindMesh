import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useState } from "react";

import { NodeColorToolbar } from "@/components/editor/node-color-toolbar";
import { ShapeGraphic } from "@/components/editor/shape-graphic";
import { MIN_NODE_SIZE } from "@/lib/canvas-shapes";
import { CLOUD_PROVIDER_BADGES, getCloudService, type CloudService } from "@/lib/cloud-services";
import { cn } from "@/lib/utils";
import { DEFAULT_NODE_TEXT_COLOR, type CanvasEdge, type CanvasNode } from "@/types/canvas";

const LABEL_PLACEHOLDER = "Add label";
const HANDLE_POSITIONS = [Position.Top, Position.Right, Position.Bottom, Position.Left];

export function CanvasNodeView({ id, data, selected }: NodeProps<CanvasNode>) {
  // Resize, label and color changes all go through onNodesChange, which syncs them via Liveblocks.
  const { updateNodeData } = useReactFlow<CanvasNode, CanvasEdge>();
  const [isEditing, setIsEditing] = useState(false);
  const service = getCloudService(data.service);

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

      <div className="relative flex max-w-full flex-col items-center gap-1">
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
              if (event.key !== "Escape") return;
              // Otherwise focus falls to <body>, out of reach of the canvas's Delete key handler.
              event.currentTarget.closest<HTMLElement>(".react-flow__node")?.focus();
              setIsEditing(false);
            }}
            // nodrag/nopan/nowheel: selecting text or scrolling must not move the node or canvas.
            className="nodrag nopan nowheel absolute inset-0 resize-none overflow-hidden bg-transparent px-4 text-center outline-none placeholder:text-copy-faint"
          />
        )}
      </div>
      {service && <ServiceBadge service={service} label={data.label} />}
      </div>
    </div>
  );
}

// Provider badge plus the service name; the name is skipped when the label already says it,
// as in "Catalog DB (Cosmos DB)".
function ServiceBadge({ service, label }: { service: CloudService; label: string }) {
  const badge = CLOUD_PROVIDER_BADGES[service.provider];
  // "Azure SQL" next to an "Azure" badge reads as "Azure | SQL", not "Azure | Azure SQL".
  const prefix = `${badge.label} `;
  const shortName = service.name.startsWith(prefix) ? service.name.slice(prefix.length) : service.name;
  const fullName = service.name.startsWith(prefix) ? service.name : `${prefix}${service.name}`;
  const showName = !label.toLowerCase().includes(shortName.toLowerCase());
  return (
    <span className="flex max-w-full items-center gap-1 px-2 text-[10px] leading-3" title={fullName}>
      <span
        className="shrink-0 rounded-sm border px-1 font-semibold"
        style={{ color: badge.color, borderColor: `${badge.color}80` }}
      >
        {badge.label}
      </span>
      {showName && <span className="truncate opacity-70">{shortName}</span>}
    </span>
  );
}
