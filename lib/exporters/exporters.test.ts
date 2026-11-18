// Run with: node --import tsx --test lib/exporters/exporters.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { toDrawio } from "@/lib/exporters/drawio";
import { toMermaid } from "@/lib/exporters/mermaid";
import type { CanvasEdge, CanvasNode, NodeShape } from "@/types/canvas";

function node(id: string, label: string, shape: NodeShape, x = 0, y = 0, width?: number, height?: number): CanvasNode {
  return {
    id,
    type: "canvasNode",
    position: { x, y },
    ...(width !== undefined && { width, height }),
    data: { label, shape, color: "#10233D", textColor: "#52A8FF" },
  };
}

function edge(source: string, target: string, label?: string): CanvasEdge {
  return { id: `${source}-${target}`, source, target, data: label === undefined ? {} : { label } };
}

const SHAPES = ["rectangle", "diamond", "circle", "pill", "cylinder", "hexagon"] as const;
const shapeNodes = SHAPES.map((shape, i) => node(shape, `${shape} label`, shape, i * 200));

test("Mermaid maps every shape", () => {
  const out = toMermaid(shapeNodes, []);
  assert.ok(out.startsWith("flowchart LR\n"));
  assert.match(out, /^ {2}rectangle\["rectangle label"\]$/m);
  assert.match(out, /^ {2}diamond\{"diamond label"\}$/m);
  assert.match(out, /^ {2}circle\(\("circle label"\)\)$/m);
  assert.match(out, /^ {2}pill\(\["pill label"\]\)$/m);
  assert.match(out, /^ {2}cylinder\[\("cylinder label"\)\]$/m);
  assert.match(out, /^ {2}hexagon\{\{"hexagon label"\}\}$/m);
  assert.match(out, /^ {2}style rectangle fill:#10233D,color:#52A8FF$/m);
});

test("draw.io maps every shape with colors and geometry", () => {
  const out = toDrawio(shapeNodes, []);
  assert.ok(out.startsWith("<mxfile") && out.includes("<diagram") && out.includes("<mxGraphModel"));
  const style = (shape: string) => out.match(new RegExp(`value="${shape} label" style="([^"]+)"`))?.[1] ?? "";
  assert.ok(style("rectangle").startsWith("rounded=1;whiteSpace"));
  assert.ok(style("diamond").startsWith("rhombus;"));
  assert.ok(style("circle").startsWith("ellipse;"));
  assert.ok(style("pill").startsWith("rounded=1;arcSize=50;"));
  assert.ok(style("cylinder").startsWith("shape=cylinder3;"));
  assert.ok(style("hexagon").startsWith("shape=hexagon;"));
  assert.ok(style("diamond").includes("fillColor=#10233D;fontColor=#52A8FF;"));
  // Position from the node, size from SHAPE_SIZES when the node has none.
  assert.match(out, /<mxGeometry x="200" y="0" width="\d+" height="\d+" as="geometry" \/>/);
});

test("quotes, < and & are escaped", () => {
  const tricky = [node("a", 'Say "hi" <b> & go\nnext', "rectangle"), node("b", "B", "rectangle")];
  const edges = [edge("a", "b", 'x < "y" & z')];

  const mermaid = toMermaid(tricky, edges);
  assert.match(mermaid, /a\["Say #quot;hi#quot; #lt;b#gt; #amp; go<br\/>next"\]/);
  assert.match(mermaid, /a -->\|"x #lt; #quot;y#quot; #amp; z"\| b/);

  const drawio = toDrawio(tricky, edges);
  // HTML-escaped for draw.io's HTML labels, then XML-escaped: no raw < & or " inside values.
  assert.ok(drawio.includes('value="Say &quot;hi&quot; &amp;lt;b&amp;gt; &amp;amp; go&lt;br&gt;next"'));
  assert.ok(drawio.includes('value="x &amp;lt; &quot;y&quot; &amp;amp; z"'));
  for (const [, value] of drawio.matchAll(/value="([^"]*)"/g)) assert.doesNotMatch(value, /[<>]/);
});

test("edge labels appear, unlabelled edges are plain", () => {
  const nodes = [node("a", "A", "rectangle"), node("b", "B", "rectangle"), node("c", "C", "rectangle")];
  const edges = [edge("a", "b", "calls"), edge("b", "c"), edge("c", "missing", "dropped")];

  const mermaid = toMermaid(nodes, edges);
  assert.match(mermaid, /^ {2}a -->\|"calls"\| b$/m);
  assert.match(mermaid, /^ {2}b --> c$/m);
  assert.ok(!mermaid.includes("dropped"));

  const drawio = toDrawio(nodes, edges);
  assert.match(drawio, /<mxCell id="edge-1" value="calls" [^>]*edge="1" parent="1" source="node-1" target="node-2">/);
  // No canvas handles: draw.io picks the sides.
  assert.doesNotMatch(drawio, /exitX=/);

  // Canvas handles become fixed exit and entry points.
  const sided = toDrawio(nodes, [{ ...edge("a", "b", "calls"), sourceHandle: "right", targetHandle: "top" }]);
  assert.match(sided, /exitX=1;exitY=0\.5;exitDx=0;exitDy=0;entryX=0\.5;entryY=0;entryDx=0;entryDy=0;/);
  assert.match(drawio, /<mxCell id="edge-2" value="" [^>]*source="node-2" target="node-3">/);
  assert.ok(!drawio.includes("dropped"));
});

test("IDs with hyphens are sanitized and kept unique", () => {
  const nodes = [
    node("pay-ledger", "Ledger", "cylinder"),
    node("pay_ledger", "Other", "rectangle"),
    node("end", "End", "circle"),
  ];
  const out = toMermaid(nodes, [edge("pay-ledger", "end", "post")]);
  assert.match(out, /^ {2}pay_ledger\[\("Ledger"\)\]$/m);
  assert.match(out, /^ {2}pay_ledger_2\["Other"\]$/m);
  assert.match(out, /^ {2}end_\(\("End"\)\)$/m);
  assert.match(out, /^ {2}pay_ledger -->\|"post"\| end_$/m);
  assert.ok(!/[^A-Za-z0-9_]/.test(out.match(/^ {2}(\S+)\[/m)?.[1] ?? ""));
});

test("boundaries become subgraphs in Mermaid and dashed outlines behind components in draw.io", () => {
  const nodes = [
    node("zone", "PCI zone", "boundary", -20, -40, 400, 200),
    node("vault", "Vault", "hexagon", 0, 0),
    node("outside", "Outside", "rectangle", 1000, 0),
  ];
  const mermaid = toMermaid(nodes, []);
  assert.match(mermaid, /^ {2}subgraph zone\["PCI zone"\]\n {4}vault\{\{"Vault"\}\}\n {2}end$/m);
  assert.match(mermaid, /^ {2}outside\["Outside"\]$/m);
  assert.match(mermaid, /^ {2}style zone .*stroke-dasharray:5 5$/m);

  const drawio = toDrawio(nodes, []);
  assert.ok(drawio.indexOf('value="PCI zone"') < drawio.indexOf('value="Vault"'));
  assert.match(drawio, /value="PCI zone" style="rounded=1;dashed=1;/);
});
