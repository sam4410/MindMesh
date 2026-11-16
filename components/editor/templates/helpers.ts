import { SHAPE_SIZES } from "@/lib/canvas-shapes";
import type { CloudServiceId } from "@/lib/cloud-services";
import type { DesignContext } from "@/lib/design-context";
import { BOUNDARY_LABEL_SPACE, BOUNDARY_PADDING, GRID } from "@/lib/design-actions";
import {
  BOUNDARY_Z_INDEX,
  NEW_EDGE_DEFAULTS,
  NODE_COLORS,
  type CanvasEdge,
  type CanvasNode,
  type NodeColor,
  type NodeShape,
} from "@/types/canvas";

export interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  // Design-context IDs from lib/design-context.ts, used by the gallery filters and chips.
  labels: Partial<DesignContext>;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

// Role colors, as the design agent uses them: blue services and gateways, purple auth and security,
// green data stores, orange queues and streams, pink users and clients, teal external systems.
export const [neutral, blue, purple, orange, red, pink, green, teal] = NODE_COLORS;

// Centers the node in a cell of the design agent's grid (lib/design-actions.ts), at the shape's
// default size, so templates line up the same way AI designs do.
export function node(
  id: string,
  label: string,
  shape: NodeShape,
  column: number,
  row: number,
  color: NodeColor = neutral,
  service?: CloudServiceId
): CanvasNode {
  const size = SHAPE_SIZES[shape];
  return {
    id,
    type: "canvasNode",
    position: {
      x: column * GRID.column + (GRID.column - size.width) / 2,
      y: row * GRID.row + (GRID.row - size.height) / 2,
    },
    ...size,
    data: { label, shape, color: color.fill, textColor: color.text, ...(service && { service }) },
  };
}

// Facing handles: left-to-right between columns, top-to-bottom within one.
export function edge(source: CanvasNode, target: CanvasNode, label = ""): CanvasEdge {
  const dx = target.position.x + (target.width ?? 0) / 2 - (source.position.x + (source.width ?? 0) / 2);
  const dy = target.position.y - source.position.y;
  const [from, to] =
    dx !== 0
      ? dx > 0 ? ["right", "left"] : ["left", "right"]
      : dy > 0 ? ["bottom", "top"] : ["top", "bottom"];
  return {
    ...NEW_EDGE_DEFAULTS,
    id: `${source.id}-${from}-${target.id}-${to}`,
    source: source.id,
    sourceHandle: from,
    target: target.id,
    targetHandle: to,
    data: { label },
  };
}

// A dashed boundary around the members, padded the way the design agent's addBoundary pads them.
export function boundary(id: string, label: string, members: CanvasNode[], color: NodeColor = red): CanvasNode {
  const left = Math.min(...members.map((m) => m.position.x)) - BOUNDARY_PADDING;
  const top = Math.min(...members.map((m) => m.position.y)) - BOUNDARY_PADDING - BOUNDARY_LABEL_SPACE;
  const right = Math.max(...members.map((m) => m.position.x + (m.width ?? 0))) + BOUNDARY_PADDING;
  const bottom = Math.max(...members.map((m) => m.position.y + (m.height ?? 0))) + BOUNDARY_PADDING;
  return {
    id,
    type: "canvasNode",
    position: { x: left, y: top },
    width: right - left,
    height: bottom - top,
    zIndex: BOUNDARY_Z_INDEX,
    data: { label, shape: "boundary", color: color.fill, textColor: color.text },
  };
}
