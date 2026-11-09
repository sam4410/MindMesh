import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { EDGE_COLOR, type CanvasEdge, type CanvasNode } from "@/types/canvas";

const LABEL_HINT = "Double-click to add label";
// Clear space kept between a wrapped label and the nodes on either side.
const LABEL_GAP_PADDING = 8;
// Below this a label wraps into a tall column, so it's allowed to overlap the nodes instead.
const MIN_LABEL_WIDTH = 72;

const isHorizontal = (position: Position) => position === Position.Left || position === Position.Right;

export function CanvasEdgeView({
  id,
  data,
  selected,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
}: EdgeProps<CanvasEdge>) {
  const { updateEdgeData } = useReactFlow<CanvasNode, CanvasEdge>();
  const [draft, setDraft] = useState<string | null>(null);
  const editStatus = useRef<"editing" | "committed" | "cancelled">("committed");
  const label = data?.label ?? "";
  const isEditing = draft !== null;

  // Right-angle routing; labelX/labelY are the path midpoint React Flow computes for us.
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });
  // Between side-by-side nodes the label sits in the gap between their facing sides (the handle
  // positions), so it wraps to that width instead of running under the nodes.
  const maxLabelWidth =
    isHorizontal(sourcePosition) && isHorizontal(targetPosition)
      ? Math.max(Math.abs(targetX - sourceX) - LABEL_GAP_PADDING, MIN_LABEL_WIDTH)
      : undefined;

  function save() {
    if (editStatus.current !== "editing") return;
    editStatus.current = "committed";
    // updateEdgeData becomes a replace change through onEdgesChange, which Liveblocks syncs.
    if (draft !== null && draft.trim() !== label) updateEdgeData(id, { label: draft.trim() });
    setDraft(null);
  }

  function startEditing() {
    editStatus.current = "editing";
    setDraft(label);
  }

  function cancelEditing() {
    editStatus.current = "cancelled";
    setDraft(null);
  }

  return (
    <>
      {/* nopan stops React Flow from zooming on double-click or panning when dragging an edge. */}
      <g className="group nopan" onDoubleClick={startEditing}>
        <BaseEdge
          id={id}
          path={path}
          markerEnd={markerEnd}
          // The invisible hit path is 24px wide; the visible stroke stays 1.5px.
          interactionWidth={24}
          style={{ stroke: EDGE_COLOR, strokeWidth: 1.5, strokeLinecap: "round" }}
          className={cn(
            "transition-opacity duration-150",
            selected ? "opacity-100" : "opacity-55 group-hover:opacity-100"
          )}
        />
      </g>

      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          className="nodrag nopan pointer-events-auto absolute text-xs"
          onDoubleClick={startEditing}
        >
          {isEditing ? (
            // The invisible copy sizes the grid cell, so the input grows with the text.
            <div className="inline-grid rounded-full border border-brand bg-surface px-2 py-0.5">
              <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre">
                {draft || LABEL_HINT}
              </span>
              <input
                autoFocus
                aria-label="Edge label"
                value={draft}
                placeholder={LABEL_HINT}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={save}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    save();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    cancelEditing();
                  }
                }}
                className="nodrag nopan col-start-1 row-start-1 w-full min-w-0 bg-transparent text-copy-primary outline-none placeholder:text-copy-faint"
              />
            </div>
          ) : label ? (
            <span
              style={{ maxWidth: maxLabelWidth }}
              className="block w-max rounded-xl border border-surface-border bg-surface px-2 py-0.5 text-center leading-snug break-words whitespace-pre-line text-copy-secondary"
            >
              {label}
            </span>
          ) : (
            selected && <span className="whitespace-pre text-copy-faint">{LABEL_HINT}</span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
