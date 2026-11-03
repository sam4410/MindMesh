import { NODE_SHAPES, type NodeShape } from "@/types/canvas";

// Custom drag type, so text or files dropped on the canvas are ignored.
export const SHAPE_DRAG_TYPE = "application/x-ghost-shape";

export interface ShapeSize {
  width: number;
  height: number;
}

export interface ShapeDragPayload extends ShapeSize {
  shape: NodeShape;
}

export const SHAPE_SIZES: Record<NodeShape, ShapeSize> = {
  rectangle: { width: 160, height: 80 },
  // Larger than the others because the label has to fit inside the inner square.
  diamond: { width: 140, height: 140 },
  circle: { width: 100, height: 100 },
  pill: { width: 160, height: 64 },
  cylinder: { width: 120, height: 100 },
  hexagon: { width: 140, height: 100 },
};

// Smallest size a node can be resized to; still fits a short label.
export const MIN_NODE_SIZE: ShapeSize = { width: 60, height: 40 };

export function shapeDragPayload(shape: NodeShape): ShapeDragPayload {
  return { shape, ...SHAPE_SIZES[shape] };
}

// Drag data can come from anywhere, so it is validated before it becomes a node.
export function readShapeDragPayload(raw: string): ShapeDragPayload | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { shape, width, height } = value as Record<string, unknown>;
  if (!NODE_SHAPES.includes(shape as NodeShape)) return null;
  if (!isPositive(width) || !isPositive(height)) return null;
  return { shape: shape as NodeShape, width, height };
}

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

let nodeCounter = 0;

// The counter keeps IDs unique when two nodes are created in the same millisecond.
export function createNodeId(shape: NodeShape) {
  nodeCounter += 1;
  return `${shape}-${Date.now()}-${nodeCounter}`;
}
