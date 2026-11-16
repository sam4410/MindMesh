import { blue, boundary, edge, green, node, orange, pink, purple, type CanvasTemplate } from "./helpers";

const merchants = node("pay-merchants", "Merchant Apps", "circle", 0, 1, pink);
const gateway = node("pay-gateway", "API Gateway", "pill", 1, 1, blue);
const vault = node("pay-vault", "Tokenization Vault", "hexagon", 2, 0, purple);
const payments = node("pay-service", "Payment Service", "rectangle", 2, 1, blue);
const ledger = node("pay-ledger", "Ledger DB", "cylinder", 2, 2, green);
const fraud = node("pay-fraud", "Fraud Check", "rectangle", 3, 0, blue);
const bus = node("pay-bus", "Event Bus", "hexagon", 3, 1, orange);
const notifications = node("pay-notifications", "Notification Service", "rectangle", 4, 0, blue);
const audit = node("pay-audit", "Audit Log Store", "cylinder", 4, 1, green);
const customers = node("pay-customers", "Buyers", "circle", 5, 0, pink);
// Card data stays inside this boundary; everything else sees tokens only.
const pciZone = boundary("pay-pci-zone", "PCI zone", [vault, payments]);

export const paymentsPlatform: CanvasTemplate = {
  id: "payments-platform",
  name: "Payments platform",
  description: "Card payments with tokenization inside a PCI zone, fraud checks, a ledger and an audited event stream.",
  labels: { cloudProvider: "agnostic", architectureStyle: "event-driven", industry: "finance", projectType: "backend-platform" },
  // The boundary comes first so the gallery preview draws it underneath.
  nodes: [pciZone, merchants, gateway, vault, payments, ledger, fraud, bus, notifications, audit, customers],
  edges: [
    edge(merchants, gateway, "HTTPS + API key"),
    edge(gateway, payments, "create payment"),
    edge(payments, vault, "tokenize card"),
    edge(payments, fraud, "risk score"),
    edge(payments, ledger, "post entries"),
    edge(payments, bus, "payment captured"),
    edge(bus, notifications, "receipt event"),
    edge(bus, audit, "append-only log"),
    edge(notifications, customers, "email receipt"),
  ],
};
