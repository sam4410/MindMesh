import type { Edge, Node } from "@xyflow/react";

// Shapes listed in ui-context.md; rendering for each lands with the custom node feature.
export const NODE_SHAPES = ["rectangle", "diamond", "circle", "pill", "cylinder", "hexagon"] as const;
export type NodeShape = (typeof NODE_SHAPES)[number];

// Default node fill from ui-context.md (neutral dark, paired with #EDEDED text).
export const DEFAULT_NODE_COLOR = "#1F1F1F";

export type CanvasNodeData = {
  label: string;
  // Node fill color.
  color: string;
  shape: NodeShape;
};

export type CanvasNode = Node<CanvasNodeData, "canvasNode">;
export type CanvasEdge = Edge<Record<string, never>, "canvasEdge">;
