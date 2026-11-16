import { blue, edge, green, node, orange, pink, purple, red, teal, type CanvasTemplate } from "./helpers";

const orders = node("ev-orders", "Order Service", "rectangle", 0, 0, blue);
const users = node("ev-users", "User Service", "rectangle", 0, 2, purple);
const bus = node("ev-bus", "Event Bus", "hexagon", 1, 1, orange);
const email = node("ev-email", "Email Worker", "rectangle", 2, 0, pink);
const analytics = node("ev-analytics", "Analytics", "rectangle", 2, 1, teal);
const inventory = node("ev-inventory", "Inventory Worker", "rectangle", 2, 2, green);
const warehouse = node("ev-warehouse", "Data Warehouse", "cylinder", 3, 1, teal);
const dlq = node("ev-dlq", "Dead Letter Queue", "cylinder", 1, 2, red);

export const eventDriven: CanvasTemplate = {
  id: "event-driven",
  name: "Event-driven system",
  description: "Producers publish to an event bus that fans out to independent consumers.",
  labels: { cloudProvider: "agnostic", architectureStyle: "event-driven", projectType: "backend-platform" },
  nodes: [orders, users, bus, email, analytics, inventory, warehouse, dlq],
  edges: [
    edge(orders, bus, "OrderPlaced"),
    edge(users, bus, "UserSignedUp"),
    edge(bus, email),
    edge(bus, analytics),
    edge(bus, inventory),
    edge(analytics, warehouse),
    edge(bus, dlq, "failed"),
  ],
};
