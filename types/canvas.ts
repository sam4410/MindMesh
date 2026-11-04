import { MarkerType, type Edge, type Node } from "@xyflow/react";

// Shapes listed in ui-context.md; rendering for each lands with the custom node feature.
export const NODE_SHAPES = ["rectangle", "diamond", "circle", "pill", "cylinder", "hexagon"] as const;
export type NodeShape = (typeof NODE_SHAPES)[number];

export interface NodeColor {
  name: string;
  fill: string;
  text: string;
}

// Node fill/text pairs from ui-context.md. They aren't theme tokens in globals.css, so they live here.
export const NODE_COLORS: readonly NodeColor[] = [
  { name: "Neutral", fill: "#1F1F1F", text: "#EDEDED" },
  { name: "Blue", fill: "#10233D", text: "#52A8FF" },
  { name: "Purple", fill: "#2E1938", text: "#BF7AF0" },
  { name: "Orange", fill: "#331B00", text: "#FF990A" },
  { name: "Red", fill: "#3C1618", text: "#FF6166" },
  { name: "Pink", fill: "#3A1726", text: "#F75F8F" },
  { name: "Green", fill: "#0F2E18", text: "#62C073" },
  { name: "Teal", fill: "#062822", text: "#0AC7B4" },
];

// The neutral pair is the default.
export const DEFAULT_NODE_COLOR = NODE_COLORS[0].fill;
export const DEFAULT_NODE_TEXT_COLOR = NODE_COLORS[0].text;

export type CanvasNodeData = {
  label: string;
  // Node fill color.
  color: string;
  // Label color paired with the fill; missing on nodes that still use the default pair.
  textColor?: string;
  shape: NodeShape;
};

export type CanvasNode = Node<CanvasNodeData, "canvasNode">;
// Default edge color from ui-context.md, also used for the arrowhead marker.
export const EDGE_COLOR = "#f8fafc";

export type CanvasEdgeData = {
  // Optional: edges created before labels existed have no data.
  label?: string;
};

export type CanvasEdge = Edge<CanvasEdgeData, "canvasEdge">;

// Every new edge gets these: connections (via React Flow's defaultEdgeOptions) and template edges.
export const NEW_EDGE_DEFAULTS = {
  type: "canvasEdge",
  markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 16, height: 16 },
} as const satisfies Pick<CanvasEdge, "type" | "markerEnd">;
