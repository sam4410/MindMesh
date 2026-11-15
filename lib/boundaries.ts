import { SHAPE_SIZES } from "@/lib/canvas-shapes";
import type { NodeShape } from "@/types/canvas";

// The geometry a boundary check needs; works for canvas nodes and spec payload nodes alike.
export interface BoxNode {
  id: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  data: { shape: NodeShape };
}

function box(node: BoxNode) {
  const size = SHAPE_SIZES[node.data.shape];
  const { x, y } = node.position ?? { x: 0, y: 0 };
  return { x, y, width: node.width ?? size.width, height: node.height ?? size.height };
}

// Components (non-boundary nodes) whose center falls inside the boundary.
export function boundaryMembers<T extends BoxNode>(boundary: BoxNode, nodes: readonly T[]): T[] {
  if (!boundary.position) return [];
  const b = box(boundary);
  return nodes.filter((node) => {
    if (node.id === boundary.id || node.data.shape === "boundary" || !node.position) return false;
    const n = box(node);
    const cx = n.x + n.width / 2;
    const cy = n.y + n.height / 2;
    return cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height;
  });
}
