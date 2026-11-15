import { CLOUD_SERVICE_ROLES, cloudServicesFor } from "@/lib/cloud-services";
import type { DesignContext } from "@/lib/design-context";

const PROVIDER_NAMES = { aws: "AWS", azure: "Azure", gcp: "Google Cloud" } as const;

function cloudRule(cloudProvider: string) {
  if (cloudProvider === "aws" || cloudProvider === "azure" || cloudProvider === "gcp") {
    const catalog = cloudServicesFor(cloudProvider);
    // One line per role from lib/cloud-services.ts, e.g. "NoSQL DB: Cosmos DB (azure.cosmos-db)".
    const services = CLOUD_SERVICE_ROLES.map((role) => {
      const options = catalog.filter((service) => service.role === role || (role === "Event stream" && service.id === "gcp.pubsub"));
      return `  - ${role}: ${options.map((service) => `${service.name} (${service.id})`).join(" / ")}`;
    }).join("\n");
    const example = catalog.find((service) => service.role === "NoSQL DB")!;
    return `Cloud provider: ${PROVIDER_NAMES[cloudProvider]}. Use ${PROVIDER_NAMES[cloudProvider]} managed services and put the service name in the node label (for example "Orders DB (${example.name})"). Set "service" on each node that maps to a managed service, using an ID from this list (a service running on Container Apps gets the Container Apps ID); use null for nodes with no managed service, such as clients and external systems. Service per role:\n${services}`;
  }
  if (cloudProvider === "on-prem") {
    return "Cloud provider: on-premises. Use generic, self-hosted technology names (PostgreSQL, Kafka, Redis, NGINX), not cloud-managed services.";
  }
  return "Cloud provider: cloud-agnostic. Use generic technology names (PostgreSQL, Kafka, Redis), not any one cloud's managed services.";
}

const STYLE_RULES: Record<string, string> = {
  monolith:
    "Architecture style: monolith. One deployable application with internal modules and a single primary database; avoid splitting it into separate services.",
  "modular-monolith":
    "Architecture style: modular monolith. One deployable application split into clearly bounded modules, each owning its own tables or schema in a shared database; modules talk through internal interfaces, not over the network.",
  microservices:
    "Architecture style: microservices. Independent services, each with its own data store and no shared database; use asynchronous messaging (a queue or event stream) between domains where the flow allows it.",
  "event-driven":
    "Architecture style: event-driven. Services publish domain events to an event bus or stream and react to events from others instead of calling each other directly; show producers, the bus and consumers.",
  serverless:
    "Architecture style: serverless. Functions plus managed services (managed databases, queues, storage, API gateway); no long-running servers or self-managed clusters.",
  "data-mesh":
    "Architecture style: data mesh. Domain-owned data products, each with its own pipeline and storage, published to a shared catalog and governance layer that consumers discover them through.",
};

const INDUSTRY_RULES: Record<string, string> = {
  finance:
    'Industry: finance. Required components: an audit log store, encryption key management, and a fraud check in the payment flow. Add an addBoundary named "PCI scope" around the components that handle payment and card data.',
  healthcare:
    'Industry: healthcare. Required components: a PHI data store isolated from other data, an audit log of every access to patient data, a consent service, and encryption key management. Add an addBoundary named "PHI zone" around the components that store or process patient data.',
  ecommerce:
    "Industry: e-commerce. Required components: a catalog cache, product search, an external payment provider, and an order queue between ordering and fulfilment.",
  saas:
    "Industry: SaaS. Required components: tenant-aware authentication and authorization, tenant isolation of data, and usage tracking for billing.",
  gaming:
    "Industry: gaming. Required components: a low-latency real-time game server tier, matchmaking, a leaderboard store, and player session state.",
  "public-sector":
    "Industry: public sector. Required components: an audit log, data stored in-region for data residency, strong identity verification, and encryption key management.",
};

const PROJECT_TYPE_RULES: Record<string, string> = {
  "backend-platform":
    "Project type: backend platform. Focus on clients, the entry point, domain services, their data stores and the messaging between them.",
  "data-warehouse":
    "Project type: data warehouse. Focus on the pipeline: sources → ingestion → raw storage → transformation → warehouse → BI and reporting.",
  "ml-platform":
    "Project type: ML platform. Focus on the model lifecycle: data sources, feature store, training, model registry, model serving, and model monitoring.",
  "cicd-pipeline":
    "Project type: CI/CD pipeline. Focus on the delivery flow: source repository → build → test → artifact registry → staged deployments to environments, with approvals and rollback.",
  "cloud-migration":
    "Project type: cloud migration. Show the current on-premises systems, the target cloud architecture, and the migration path between them (data replication, cutover, coexistence).",
  "realtime-app":
    "Project type: real-time app. Focus on persistent client connections (WebSocket or similar), a real-time messaging or pub/sub layer, presence or state sync, and storage for history.",
};

// The "Design context" block appended to the design agent's request, or "" when nothing is set.
export function buildDesignContextRules(ctx: DesignContext): string {
  const rules = [
    ctx.cloudProvider && cloudRule(ctx.cloudProvider),
    ctx.architectureStyle && STYLE_RULES[ctx.architectureStyle],
    ctx.industry && INDUSTRY_RULES[ctx.industry],
    ctx.projectType && PROJECT_TYPE_RULES[ctx.projectType],
  ].filter((rule): rule is string => Boolean(rule));
  if (rules.length === 0) return "";
  return `Design context (the project's settings; follow these rules, and include their required components even when the request doesn't name them):\n${rules.map((rule) => `- ${rule}`).join("\n")}`;
}
