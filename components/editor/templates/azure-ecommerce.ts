import { blue, edge, green, neutral, node, orange, pink, purple, type CanvasTemplate } from "./helpers";

const customers = node("az-customers", "Shoppers", "circle", 0, 2, pink);
const frontDoor = node("az-front-door", "Front Door", "pill", 1, 2, blue, "azure.front-door");
const apim = node("az-apim", "API Management", "pill", 2, 2, blue, "azure.api-management");
const monitor = node("az-monitor", "Monitor", "hexagon", 2, 1, neutral, "azure.monitor");
const keyVault = node("az-key-vault", "Key Vault", "hexagon", 2, 3, purple, "azure.key-vault");
const catalog = node("az-catalog", "Catalog Service", "rectangle", 3, 0, blue, "azure.container-apps");
const cart = node("az-cart", "Cart Service", "rectangle", 3, 1, blue, "azure.container-apps");
const orders = node("az-orders", "Order Service", "rectangle", 3, 2, blue, "azure.container-apps");
const payments = node("az-payments", "Payment Service", "rectangle", 3, 3, blue, "azure.container-apps");
const catalogDb = node("az-catalog-db", "Catalog DB", "cylinder", 4, 0, green, "azure.cosmos-db");
const cartCache = node("az-cart-cache", "Cart Cache", "cylinder", 4, 1, green, "azure.redis");
const ordersDb = node("az-orders-db", "Orders DB", "cylinder", 4, 2, green, "azure.sql");
const serviceBus = node("az-service-bus", "Service Bus", "hexagon", 4, 3, orange, "azure.service-bus");

export const azureEcommerce: CanvasTemplate = {
  id: "azure-microservices-ecommerce",
  name: "Azure microservices e-commerce",
  description: "Front Door and API Management in front of Container Apps services, with Cosmos DB, Azure SQL, Redis and Service Bus.",
  labels: {
    cloudProvider: "azure",
    architectureStyle: "microservices",
    industry: "ecommerce",
    projectType: "backend-platform",
  },
  nodes: [customers, frontDoor, apim, monitor, keyVault, catalog, cart, orders, payments, catalogDb, cartCache, ordersDb, serviceBus],
  edges: [
    edge(customers, frontDoor, "HTTPS"),
    edge(frontDoor, apim, "routes /api"),
    edge(apim, monitor, "logs & metrics"),
    edge(apim, catalog, "browse"),
    edge(apim, cart, "cart API"),
    edge(apim, orders, "checkout"),
    edge(catalog, catalogDb, "reads products"),
    edge(cart, cartCache, "session cart"),
    edge(orders, ordersDb, "writes orders"),
    edge(orders, serviceBus, "OrderPlaced"),
    edge(serviceBus, payments, "charge request"),
    edge(payments, keyVault, "provider keys"),
  ],
};
