import { boundaryMembers } from "@/lib/boundaries";
import { SHAPE_SIZES } from "@/lib/canvas-shapes";
import { DEFAULT_NODE_TEXT_COLOR, type CanvasEdge, type CanvasNode, type NodeShape } from "@/types/canvas";

// Opening and closing brackets per canvas shape (spec 51). Boundaries become subgraphs instead.
const SHAPES: Record<Exclude<NodeShape, "boundary">, [string, string]> = {
  rectangle: ["[", "]"],
  diamond: ["{", "}"],
  circle: ["((", "))"],
  pill: ["([", "])"],
  cylinder: ["[(", ")]"],
  hexagon: ["{{", "}}"],
};

// Words Mermaid reads as statements when they start a line, so they can't be node IDs as is.
const RESERVED_IDS = new Set(["end", "graph", "flowchart", "subgraph", "style", "classdef", "class", "click", "linkstyle", "direction", "default"]);

// Mermaid entity codes, so labels can't break out of their quotes or turn into HTML; newlines become <br/>.
export function escapeMermaidLabel(text: string) {
  return text
    .replace(/&/g, "#amp;")
    .replace(/</g, "#lt;")
    .replace(/>/g, "#gt;")
    .replace(/"/g, "#quot;")
    .replace(/\r?\n/g, "<br/>");
}

// Canvas IDs → unique Mermaid IDs of [A-Za-z0-9_].
function mermaidIds(nodes: CanvasNode[]) {
  const ids = new Map<string, string>();
  const used = new Set<string>();
  for (const node of nodes) {
    let base = node.id.replace(/[^A-Za-z0-9_]/g, "_") || "node";
    if (RESERVED_IDS.has(base.toLowerCase())) base += "_";
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}_${n}`;
    used.add(id);
    ids.set(node.id, id);
  }
  return ids;
}

function area(node: CanvasNode) {
  const size = SHAPE_SIZES[node.data.shape];
  return (node.width ?? size.width) * (node.height ?? size.height);
}

/**
 * The canvas as a Mermaid `flowchart LR`: shapes per spec 51, labelled edges, and `style` lines
 * from node colors. Each boundary becomes a subgraph holding the components whose centers it
 * encloses (the smallest one when boundaries overlap, since Mermaid allows a node in one subgraph).
 */
export function toMermaid(nodes: CanvasNode[], edges: CanvasEdge[]): string {
  const ids = mermaidIds(nodes);
  const components = nodes.filter((node) => node.data.shape !== "boundary");
  const boundaries = nodes.filter((node) => node.data.shape === "boundary").sort((a, b) => area(a) - area(b));

  // Smallest enclosing boundary per component.
  const parentOf = new Map<string, string>();
  for (const boundary of boundaries) {
    for (const member of boundaryMembers(boundary, components)) {
      if (!parentOf.has(member.id)) parentOf.set(member.id, boundary.id);
    }
  }

  const nodeLine = (node: CanvasNode, indent: string) => {
    const [open, close] = SHAPES[node.data.shape as Exclude<NodeShape, "boundary">];
    return `${indent}${ids.get(node.id)}${open}"${escapeMermaidLabel(node.data.label)}"${close}`;
  };

  const lines = ["flowchart LR"];
  for (const node of components) {
    if (!parentOf.has(node.id)) lines.push(nodeLine(node, "  "));
  }
  for (const boundary of boundaries) {
    lines.push(`  subgraph ${ids.get(boundary.id)}["${escapeMermaidLabel(boundary.data.label)}"]`);
    for (const node of components) {
      if (parentOf.get(node.id) === boundary.id) lines.push(nodeLine(node, "    "));
    }
    lines.push("  end");
  }

  for (const edge of edges) {
    const source = ids.get(edge.source);
    const target = ids.get(edge.target);
    // An edge whose end isn't on the canvas can't be drawn.
    if (!source || !target) continue;
    const label = edge.data?.label?.trim();
    lines.push(label ? `  ${source} -->|"${escapeMermaidLabel(label)}"| ${target}` : `  ${source} --> ${target}`);
  }

  for (const node of nodes) {
    const text = node.data.textColor ?? DEFAULT_NODE_TEXT_COLOR;
    const style =
      node.data.shape === "boundary"
        ? `fill:${node.data.color},stroke:${text},color:${text},stroke-dasharray:5 5`
        : `fill:${node.data.color},color:${text}`;
    lines.push(`  style ${ids.get(node.id)} ${style}`);
  }

  return `${lines.join("\n")}\n`;
}
