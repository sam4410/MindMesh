import { z } from "zod";

import { MAX_BOUNDARY_SIZE, MIN_NODE_SIZE, SHAPE_SIZES, createNodeId } from "@/lib/canvas-shapes";
import { CLOUD_SERVICE_IDS } from "@/lib/cloud-services";
import {
  BOUNDARY_Z_INDEX,
  NEW_EDGE_DEFAULTS,
  NODE_COLORS,
  NODE_SHAPES,
  type CanvasEdge,
  type CanvasNode,
  type NodeShape,
} from "@/types/canvas";

// A left-to-right flow, one node per cell, shared with the starter templates. Columns are 280px
// apart so edge labels between neighbouring columns have room for one line.
export const GRID = { column: 280, row: 160 } as const;
// Largest size the agent may give a node, so it still fits its cell.
export const MAX_NODE_SIZE = { width: 200, height: 140 } as const;
// Clear space kept around every node the agent places.
const NODE_MARGIN = 20;
const MAX_LABEL_LENGTH = 60;

const COLOR_NAMES = NODE_COLORS.map((color) => color.name) as [string, ...string[]];

// Written for OpenAI's strict structured output, which Gemini also accepts: a plain union
// (anyOf, not oneOf), every field required with null for "not given", and no string length rules.
// An empty or unknown id just matches nothing and the action is skipped.
const id = z.string();
// Boundaries aren't components; the agent gets a dedicated action for them in spec 69.
const AI_SHAPES = NODE_SHAPES.filter((s) => s !== "boundary") as [NodeShape, ...NodeShape[]];
const shape = z.enum(AI_SHAPES);
const color = z.enum(COLOR_NAMES);
const cell = { column: z.number().int(), row: z.number().int() };
// Nullable, not optional, for OpenAI's strict schema.
const CLEAR_SERVICE = "clear";
const service = z.enum([CLEAR_SERVICE, ...CLOUD_SERVICE_IDS]).nullable();
// Why this component and service (spec 72); stored on the node as its rationale.
const reason = z
  .string()
  .nullable()
  .describe("why this component and service over the likely alternatives, at most two sentences; null for layout or label-only changes");

// What the model may ask for. Everything it returns is checked again when applied.
export const designPlanSchema = z.object({
  // First on purpose: the model writes fields in order, so it reasons about the architecture
  // before committing to actions. Logged only, never shown to users.
  plan: z
    .string()
    .describe("Written first: the components and every flow between them, checked against the architecture rules."),
  // Before the actions, so the model decides before it draws (spec 72). Cut to 8 when saved.
  decisions: z
    .array(
      z.object({
        title: z.string().describe("the decision, a few words"),
        choice: z.string().describe("what was chosen, naming the components"),
        reasons: z.array(z.string()).describe("1 to 3 reasons"),
        alternatives: z.array(z.string()).describe("0 to 3 alternatives considered"),
        tradeoffs: z.string().describe("one sentence"),
        nodeIds: z.array(id).describe("the nodes this decision shapes: your temporary ids for new nodes, canvas ids for existing ones"),
        sourceUrls: z.array(z.string()).describe("URLs from the research notes' sources only; empty without research"),
      })
    )
    .describe("the 3 to 8 choices that shape the design"),
  summary: z.string().describe("One or two sentences on what was designed or changed."),
  actions: z.array(
    z.union([
      z.object({
        type: z.literal("addNode"),
        id,
        label: z.string(),
        shape,
        color,
        service: service.describe('managed cloud service ID; "clear" or null means no service'),
        ...cell,
        reason,
      }),
      z.object({ type: z.literal("moveNode"), id, ...cell }),
      z.object({ type: z.literal("resizeNode"), id, width: z.number(), height: z.number() }),
      z.object({
        type: z.literal("updateNodeData"),
        id,
        label: z.string().nullable().describe("null keeps the current label"),
        shape: shape.nullable().describe("null keeps the current shape"),
        color: color.nullable().describe("null keeps the current color"),
        service: service.describe('managed cloud service ID; null keeps the current service, "clear" removes it'),
        width: z.number().nullable().describe("explicit width for a shape change, or null for the shape default"),
        height: z.number().nullable().describe("explicit height for a shape change, or null for the shape default"),
        reason,
      }),
      z.object({ type: z.literal("deleteNode"), id }),
      z.object({
        type: z.literal("addEdge"),
        source: id,
        target: id,
        label: z.string().nullable().describe("null for no label"),
      }),
      z.object({ type: z.literal("deleteEdge"), id }),
      z.object({
        type: z.literal("addBoundary"),
        id,
        label: z.string(),
        memberIds: z.array(id).describe("ids of the nodes to enclose; at least one"),
        color,
      }),
      z.object({
        type: z.literal("updateBoundary"),
        id,
        label: z.string().nullable().describe("null keeps the current label"),
        memberIds: z.array(id).nullable().describe("null keeps the current size and position"),
        color: color.nullable().describe("null keeps the current color"),
      }),
    ])
  ),
});

export type DesignPlan = z.infer<typeof designPlanSchema>;
export type DesignAction = DesignPlan["actions"][number];

// The subset of mutateFlow's MutableFlow that applying an action needs.
export interface FlowLike {
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
  getNode(id: string): CanvasNode | undefined;
  getEdge(id: string): CanvasEdge | undefined;
  addNode(node: CanvasNode): void;
  updateNode(id: string, partial: Partial<CanvasNode>): void;
  updateNodeData(id: string, partial: Partial<CanvasNode["data"]>): void;
  updateNodeData(id: string, updater: (data: CanvasNode["data"]) => CanvasNode["data"]): void;
  removeNode(id: string): void;
  addEdge(edge: CanvasEdge): void;
  removeEdge(id: string): void;
  removeEdges(ids: string[]): void;
}

interface Point {
  x: number;
  y: number;
}

interface Box extends Point {
  width: number;
  height: number;
}

function sizeOf(node: CanvasNode) {
  const fallback = SHAPE_SIZES[node.data.shape] ?? SHAPE_SIZES.rectangle;
  return { width: node.width ?? fallback.width, height: node.height ?? fallback.height };
}

function boxOf(node: CanvasNode): Box {
  return { ...node.position, ...sizeOf(node) };
}

function centerOf(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function overlaps(a: Box, b: Box) {
  return (
    a.x < b.x + b.width + NODE_MARGIN &&
    b.x < a.x + a.width + NODE_MARGIN &&
    a.y < b.y + b.height + NODE_MARGIN &&
    b.y < a.y + a.height + NODE_MARGIN
  );
}

// The grid cell a node's center falls in, as described to the model.
export function cellOf(node: CanvasNode) {
  const center = centerOf(boxOf(node));
  return { column: Math.floor(center.x / GRID.column), row: Math.floor(center.y / GRID.row) };
}

// Centers the node in the requested cell, moving down a row at a time past anything in the way.
function placeInCell(
  flow: FlowLike,
  column: number,
  row: number,
  size: { width: number; height: number },
  ignoreId?: string
): Point {
  // Boundaries are drawn around nodes, so they never block a cell.
  const others = flow.nodes.filter((node) => node.id !== ignoreId && !isBoundary(node)).map(boxOf);
  let position: Point = { x: 0, y: 0 };
  // shortcut: gives up after 50 rows and accepts an overlap, fine until a column holds more nodes.
  for (let r = row; r < row + 50; r++) {
    position = {
      x: column * GRID.column + (GRID.column - size.width) / 2,
      y: r * GRID.row + (GRID.row - size.height) / 2,
    };
    if (!others.some((box) => overlaps({ ...position, ...size }, box))) break;
  }
  return position;
}

function isBoundary(node: CanvasNode) {
  return node.data.shape === "boundary";
}

// Padding around the enclosed nodes, plus room above them for the boundary's label.
export const BOUNDARY_PADDING = 40;
export const BOUNDARY_LABEL_SPACE = 28;

// The box that encloses the given (existing, non-boundary) nodes with padding, or null if none exist.
function boundaryBox(flow: FlowLike, memberIds: readonly string[], resolve: (ref: string) => string): Box | null {
  const members = memberIds
    .map((ref) => flow.getNode(resolve(ref)))
    .filter((node): node is CanvasNode => node !== undefined && !isBoundary(node));
  if (members.length === 0) return null;
  const boxes = members.map(boxOf);
  const left = Math.min(...boxes.map((b) => b.x)) - BOUNDARY_PADDING;
  const top = Math.min(...boxes.map((b) => b.y)) - BOUNDARY_PADDING - BOUNDARY_LABEL_SPACE;
  const right = Math.max(...boxes.map((b) => b.x + b.width)) + BOUNDARY_PADDING;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + BOUNDARY_PADDING;
  return {
    x: left,
    y: top,
    width: Math.min(right - left, MAX_BOUNDARY_SIZE.width),
    height: Math.min(bottom - top, MAX_BOUNDARY_SIZE.height),
  };
}

function colorPair(name: string | undefined) {
  const pair = NODE_COLORS.find((c) => c.name === name) ?? NODE_COLORS[0];
  return { color: pair.fill, textColor: pair.text };
}

function cleanLabel(label: string) {
  return label.trim().slice(0, MAX_LABEL_LENGTH);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.round(value), min), max);
}

// Picks facing handles: left-to-right between columns, top-to-bottom within one.
function handlesFor(source: Box, target: Box) {
  const from = centerOf(source);
  const to = centerOf(target);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? (["right", "left"] as const) : (["left", "right"] as const);
  }
  return dy >= 0 ? (["bottom", "top"] as const) : (["top", "bottom"] as const);
}

/**
 * Applies one action to the live flow. `ids` maps the model's ids for new nodes to real ones.
 * Returns where the agent's cursor should go, or null when the action was skipped because it
 * refers to something that doesn't exist (for example, a node a collaborator just deleted).
 */
export function applyDesignAction(
  flow: FlowLike,
  action: DesignAction,
  ids: Map<string, string>
): Point | null {
  const resolve = (ref: string) => ids.get(ref) ?? ref;

  switch (action.type) {
    case "addNode": {
      if (ids.has(action.id)) return null;
      const size = SHAPE_SIZES[action.shape];
      const position = placeInCell(flow, action.column, action.row, size);
      const nodeId = createNodeId(action.shape);
      ids.set(action.id, nodeId);
      flow.addNode({
        id: nodeId,
        type: "canvasNode",
        position,
        ...size,
        data: {
          label: cleanLabel(action.label),
          shape: action.shape,
          ...colorPair(action.color),
          ...(action.service && action.service !== CLEAR_SERVICE && { service: action.service }),
        },
      });
      return centerOf({ ...position, ...size });
    }
    case "moveNode": {
      const node = flow.getNode(resolve(action.id));
      // Boundaries change only through updateBoundary, which re-fits them to their members.
      if (!node || isBoundary(node)) return null;
      const size = sizeOf(node);
      const position = placeInCell(flow, action.column, action.row, size, node.id);
      flow.updateNode(node.id, { position });
      return centerOf({ ...position, ...size });
    }
    case "resizeNode": {
      const node = flow.getNode(resolve(action.id));
      if (!node || isBoundary(node)) return null;
      const width = clamp(action.width, MIN_NODE_SIZE.width, MAX_NODE_SIZE.width);
      const height = clamp(action.height, MIN_NODE_SIZE.height, MAX_NODE_SIZE.height);
      flow.updateNode(node.id, { width, height });
      return centerOf({ ...node.position, width, height });
    }
    case "updateNodeData": {
      const node = flow.getNode(resolve(action.id));
      if (!node || isBoundary(node)) return null;
      let updatedBox: Box | null = null;
      if (action.shape != null && action.shape !== node.data.shape) {
        const defaultSize = SHAPE_SIZES[action.shape];
        const size = {
          width: clamp(action.width ?? defaultSize.width, MIN_NODE_SIZE.width, MAX_NODE_SIZE.width),
          height: clamp(action.height ?? defaultSize.height, MIN_NODE_SIZE.height, MAX_NODE_SIZE.height),
        };
        flow.updateNode(node.id, size);
        updatedBox = { ...node.position, ...size };
      }
      flow.updateNodeData(node.id, (data) => {
        const updated = {
          ...data,
          ...(action.label != null && { label: cleanLabel(action.label) }),
          ...(action.shape != null && { shape: action.shape }),
          ...(action.color != null && colorPair(action.color)),
          ...(action.service != null &&
            action.service !== CLEAR_SERVICE && { service: action.service }),
        };
        if (action.service === CLEAR_SERVICE) delete updated.service;
        return updated;
      });
      return centerOf(updatedBox ?? boxOf(node));
    }
    case "deleteNode": {
      const node = flow.getNode(resolve(action.id));
      if (!node) return null;
      // Like the canvas's own delete, a node takes its edges with it.
      flow.removeEdges(
        flow.edges.filter((e) => e.source === node.id || e.target === node.id).map((e) => e.id)
      );
      flow.removeNode(node.id);
      return centerOf(boxOf(node));
    }
    case "addEdge": {
      const source = flow.getNode(resolve(action.source));
      const target = flow.getNode(resolve(action.target));
      // Boundaries are never connected by edges.
      if (!source || !target || source.id === target.id || isBoundary(source) || isBoundary(target)) return null;
      if (flow.edges.some((e) => e.source === source.id && e.target === target.id)) return null;
      const [from, to] = handlesFor(boxOf(source), boxOf(target));
      flow.addEdge({
        ...NEW_EDGE_DEFAULTS,
        id: `${source.id}-${from}-${target.id}-${to}`,
        source: source.id,
        sourceHandle: from,
        target: target.id,
        targetHandle: to,
        data: { label: cleanLabel(action.label ?? "") },
      });
      const a = centerOf(boxOf(source));
      const b = centerOf(boxOf(target));
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    case "deleteEdge": {
      const edge = flow.getEdge(action.id);
      if (!edge) return null;
      flow.removeEdge(edge.id);
      const source = flow.getNode(edge.source);
      return source ? centerOf(boxOf(source)) : null;
    }
    case "addBoundary": {
      if (ids.has(action.id)) return null;
      const box = boundaryBox(flow, action.memberIds, resolve);
      if (!box) return null;
      const label = cleanLabel(action.label);
      // A boundary with the same label already on the canvas is re-fitted instead of duplicated,
      // so re-running a design keeps one "PCI scope".
      const existing = flow.nodes.find(
        (node) => isBoundary(node) && node.data.label.trim().toLowerCase() === label.toLowerCase()
      );
      if (existing) {
        ids.set(action.id, existing.id);
        flow.updateNode(existing.id, { position: { x: box.x, y: box.y }, width: box.width, height: box.height });
        flow.updateNodeData(existing.id, colorPair(action.color));
        return { x: box.x, y: box.y };
      }
      const nodeId = createNodeId("boundary");
      ids.set(action.id, nodeId);
      flow.addNode({
        id: nodeId,
        type: "canvasNode",
        position: { x: box.x, y: box.y },
        width: box.width,
        height: box.height,
        zIndex: BOUNDARY_Z_INDEX,
        data: { label, shape: "boundary", ...colorPair(action.color) },
      });
      return { x: box.x, y: box.y };
    }
    case "updateBoundary": {
      const node = flow.getNode(resolve(action.id));
      if (!node || !isBoundary(node)) return null;
      let box: Box = boxOf(node);
      if (action.memberIds) {
        const fitted = boundaryBox(flow, action.memberIds, resolve);
        if (!fitted) return null;
        box = fitted;
        flow.updateNode(node.id, { position: { x: box.x, y: box.y }, width: box.width, height: box.height });
      }
      flow.updateNodeData(node.id, {
        ...(action.label != null && { label: cleanLabel(action.label) }),
        ...(action.color && colorPair(action.color)),
      });
      return { x: box.x, y: box.y };
    }
  }
}
