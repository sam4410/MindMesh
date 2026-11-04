import type { CanvasEdge, CanvasNode } from "@/types/canvas";

export interface CanvasSnapshot {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export function canvasBlobPath(projectId: string) {
  return `canvas/${projectId}.json`;
}

// The per-client fields Liveblocks doesn't sync either; without them, selecting a node isn't a change.
const LOCAL_FIELDS = new Set(["selected", "dragging", "measured", "resizing"]);

export function serializeCanvas(nodes: CanvasNode[], edges: CanvasEdge[]) {
  return JSON.stringify({ nodes, edges }, (key, value) =>
    LOCAL_FIELDS.has(key) ? undefined : value
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNode(value: unknown) {
  if (!isRecord(value) || typeof value.id !== "string" || !isRecord(value.data)) return false;
  const { position } = value;
  return isRecord(position) && Number.isFinite(position.x) && Number.isFinite(position.y);
}

function isEdge(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.source === "string" &&
    typeof value.target === "string"
  );
}

// A snapshot gets replayed into the room on load, so a malformed one could break the canvas for everyone.
export function isCanvasSnapshot(value: unknown): value is CanvasSnapshot {
  return (
    isRecord(value) &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isNode) &&
    Array.isArray(value.edges) &&
    value.edges.every(isEdge)
  );
}
