import { SHAPE_SIZES } from "@/lib/canvas-shapes";
import {
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
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const [neutral, blue, purple, orange, red, pink, green, teal] = NODE_COLORS;

type Side = "top" | "right" | "bottom" | "left";

// Positions are the node's top-left corner; sizes come from the shape's default drop size.
function node(
  id: string,
  label: string,
  shape: NodeShape,
  x: number,
  y: number,
  color: NodeColor = neutral
): CanvasNode {
  return {
    id,
    type: "canvasNode",
    position: { x, y },
    ...SHAPE_SIZES[shape],
    data: { label, shape, color: color.fill, textColor: color.text },
  };
}

// Handle ids match the node's handle positions (top/right/bottom/left).
function edge(source: string, from: Side, target: string, to: Side, label = ""): CanvasEdge {
  return {
    ...NEW_EDGE_DEFAULTS,
    id: `${source}-${from}-${target}-${to}`,
    source,
    sourceHandle: from,
    target,
    targetHandle: to,
    data: { label },
  };
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: "microservices",
    name: "Microservices",
    description: "An API gateway routing to independent services, each with its own datastore.",
    nodes: [
      node("ms-client", "Web Client", "circle", 0, 150),
      node("ms-gateway", "API Gateway", "pill", 180, 168, blue),
      node("ms-auth", "Auth Service", "rectangle", 420, 0, purple),
      node("ms-orders", "Order Service", "rectangle", 420, 160, orange),
      node("ms-payments", "Payment Service", "rectangle", 420, 320, green),
      node("ms-users-db", "Users DB", "cylinder", 660, -10, purple),
      node("ms-orders-db", "Orders DB", "cylinder", 660, 150, orange),
      node("ms-provider", "Payment Provider", "hexagon", 650, 310, teal),
    ],
    edges: [
      edge("ms-client", "right", "ms-gateway", "left", "HTTPS"),
      edge("ms-gateway", "right", "ms-auth", "left"),
      edge("ms-gateway", "right", "ms-orders", "left"),
      edge("ms-gateway", "right", "ms-payments", "left"),
      edge("ms-auth", "right", "ms-users-db", "left"),
      edge("ms-orders", "right", "ms-orders-db", "left"),
      edge("ms-orders", "bottom", "ms-payments", "top", "charge"),
      edge("ms-payments", "right", "ms-provider", "left"),
    ],
  },
  {
    id: "ci-cd-pipeline",
    name: "CI/CD pipeline",
    description: "From a git push through build, tests and a quality gate to staged deployments.",
    nodes: [
      node("ci-push", "Git Push", "circle", 0, 10),
      node("ci-build", "Build", "rectangle", 160, 20, blue),
      node("ci-tests", "Run Tests", "rectangle", 400, 20, purple),
      node("ci-gate", "Tests pass?", "diamond", 640, -10, orange),
      node("ci-notify", "Notify Team", "hexagon", 640, 200, red),
      node("ci-registry", "Image Registry", "cylinder", 860, 10, teal),
      node("ci-staging", "Deploy Staging", "pill", 840, 218, green),
      node("ci-prod", "Deploy Production", "pill", 1080, 218, green),
    ],
    edges: [
      edge("ci-push", "right", "ci-build", "left"),
      edge("ci-build", "right", "ci-tests", "left"),
      edge("ci-tests", "right", "ci-gate", "left"),
      edge("ci-gate", "right", "ci-registry", "left", "pass"),
      edge("ci-gate", "bottom", "ci-notify", "top", "fail"),
      edge("ci-registry", "bottom", "ci-staging", "top"),
      edge("ci-staging", "right", "ci-prod", "left", "approve"),
    ],
  },
  {
    id: "event-driven",
    name: "Event-driven system",
    description: "Producers publish to an event bus that fans out to independent consumers.",
    nodes: [
      node("ev-orders", "Order Service", "rectangle", 0, 60, blue),
      node("ev-users", "User Service", "rectangle", 0, 220, purple),
      node("ev-bus", "Event Bus", "hexagon", 260, 130, orange),
      node("ev-email", "Email Worker", "rectangle", 500, -20, pink),
      node("ev-analytics", "Analytics", "rectangle", 500, 140, teal),
      node("ev-inventory", "Inventory Worker", "rectangle", 500, 300, green),
      node("ev-warehouse", "Data Warehouse", "cylinder", 740, 130, teal),
      node("ev-dlq", "Dead Letter Queue", "cylinder", 270, 330, red),
    ],
    edges: [
      edge("ev-orders", "right", "ev-bus", "left", "OrderPlaced"),
      edge("ev-users", "right", "ev-bus", "left", "UserSignedUp"),
      edge("ev-bus", "right", "ev-email", "left"),
      edge("ev-bus", "right", "ev-analytics", "left"),
      edge("ev-bus", "right", "ev-inventory", "left"),
      edge("ev-analytics", "right", "ev-warehouse", "left"),
      edge("ev-bus", "bottom", "ev-dlq", "top", "failed"),
    ],
  },
];
