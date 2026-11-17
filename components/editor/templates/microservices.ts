import { blue, edge, green, node, orange, purple, teal, type CanvasTemplate } from "./helpers";

const client = node("ms-client", "Web Client", "circle", 0, 1);
const gateway = node("ms-gateway", "API Gateway", "pill", 1, 1, blue);
const auth = node("ms-auth", "Auth Service", "rectangle", 2, 0, purple);
const orders = node("ms-orders", "Order Service", "rectangle", 2, 1, orange);
const payments = node("ms-payments", "Payment Service", "rectangle", 2, 2, green);
const usersDb = node("ms-users-db", "Users DB", "cylinder", 3, 0, purple);
const ordersDb = node("ms-orders-db", "Orders DB", "cylinder", 3, 1, orange);
const provider = node("ms-provider", "Payment Provider", "hexagon", 3, 2, teal);

export const microservices: CanvasTemplate = {
  id: "microservices",
  name: "Microservices",
  description: "An API gateway routing to independent services, each with its own datastore.",
  labels: { cloudProvider: "agnostic", architectureStyle: "microservices", projectType: "backend-platform" },
  nodes: [client, gateway, auth, orders, payments, usersDb, ordersDb, provider],
  edges: [
    edge(client, gateway, "HTTPS"),
    edge(gateway, auth),
    edge(gateway, orders),
    edge(gateway, payments),
    edge(auth, usersDb),
    edge(orders, ordersDb),
    edge(orders, payments, "charge"),
    edge(payments, provider),
  ],
};
