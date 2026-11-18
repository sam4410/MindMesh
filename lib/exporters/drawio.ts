import { SHAPE_SIZES } from "@/lib/canvas-shapes";
import { DEFAULT_NODE_TEXT_COLOR, type CanvasEdge, type CanvasNode, type NodeShape } from "@/types/canvas";

// Vertex styles per canvas shape (spec 51). A boundary is a dashed outline with its label top-left.
const SHAPE_STYLES: Record<NodeShape, string> = {
  rectangle: "rounded=1",
  diamond: "rhombus",
  circle: "ellipse",
  pill: "rounded=1;arcSize=50",
  cylinder: "shape=cylinder3",
  hexagon: "shape=hexagon",
  boundary: "rounded=1;dashed=1;verticalAlign=top;align=left;spacingLeft=8;spacingTop=4",
};

// Where each canvas handle sits on a node (fractions of its box), so draw.io leaves and enters the
// same sides as the canvas instead of routing center to center through other shapes.
const HANDLE_POINTS: Record<string, [number, number]> = {
  top: [0.5, 0],
  right: [1, 0.5],
  bottom: [0.5, 1],
  left: [0, 0.5],
};

function handleStyle(prefix: "exit" | "entry", handle: string | null | undefined) {
  const point = handle ? HANDLE_POINTS[handle] : undefined;
  return point ? `${prefix}X=${point[0]};${prefix}Y=${point[1]};${prefix}Dx=0;${prefix}Dy=0;` : "";
}

export function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\r?\n/g, "&#10;");
}

// Labels use draw.io's HTML mode so they wrap; the text is HTML-escaped first so it shows as typed.
function labelValue(text: string) {
  const html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r?\n/g, "<br>");
  return escapeXml(html);
}

/**
 * The canvas as an uncompressed draw.io document: one vertex per node at its canvas position and
 * size with its fill and text colors, and one edge per connection with its label. Boundaries come
 * first, so they sit behind the components.
 */
export function toDrawio(nodes: CanvasNode[], edges: CanvasEdge[]): string {
  // Cell IDs "0" and "1" are the root and the default layer, so canvas IDs aren't reused as is.
  const cellIds = new Map(nodes.map((node, index) => [node.id, `node-${index + 1}`]));
  const ordered = [
    ...nodes.filter((node) => node.data.shape === "boundary"),
    ...nodes.filter((node) => node.data.shape !== "boundary"),
  ];

  const cells = ['<mxCell id="0" />', '<mxCell id="1" parent="0" />'];
  for (const node of ordered) {
    const size = SHAPE_SIZES[node.data.shape];
    const { x, y } = node.position;
    const width = node.width ?? size.width;
    const height = node.height ?? size.height;
    const text = node.data.textColor ?? DEFAULT_NODE_TEXT_COLOR;
    const colors =
      node.data.shape === "boundary"
        ? `fillColor=${node.data.color};strokeColor=${text};fontColor=${text}`
        : `fillColor=${node.data.color};fontColor=${text}`;
    const style = `${SHAPE_STYLES[node.data.shape]};whiteSpace=wrap;html=1;${colors};`;
    cells.push(
      `<mxCell id="${cellIds.get(node.id)}" value="${labelValue(node.data.label)}" style="${escapeXml(style)}" vertex="1" parent="1">` +
        `<mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" />` +
        "</mxCell>"
    );
  }

  edges.forEach((edge, index) => {
    const source = cellIds.get(edge.source);
    const target = cellIds.get(edge.target);
    // An edge whose end isn't on the canvas can't be drawn.
    if (!source || !target) return;
    const style =
      "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=classic;" +
      handleStyle("exit", edge.sourceHandle) +
      handleStyle("entry", edge.targetHandle);
    cells.push(
      `<mxCell id="edge-${index + 1}" value="${labelValue(edge.data?.label ?? "")}" ` +
        `style="${style}" edge="1" parent="1" source="${source}" target="${target}">` +
        '<mxGeometry relative="1" as="geometry" />' +
        "</mxCell>"
    );
  });

  return [
    '<mxfile host="MindMesh" type="device">',
    '  <diagram id="mindmesh-diagram" name="Diagram">',
    '    <mxGraphModel grid="1" gridSize="10" guides="1" connect="1" arrows="1" page="0">',
    "      <root>",
    ...cells.map((cell) => `        ${cell}`),
    "      </root>",
    "    </mxGraphModel>",
    "  </diagram>",
    "</mxfile>",
    "",
  ].join("\n");
}
