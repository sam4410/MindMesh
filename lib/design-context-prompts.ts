import { CLOUD_SERVICE_ROLES, cloudServicesFor } from "@/lib/cloud-services";
import { formatDesignContext, type DesignContext } from "@/lib/design-context";

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

// Frameworks named in a spec's compliance section, per regulated industry.
const COMPLIANCE_FRAMEWORKS: Record<string, string> = {
  finance: "PCI-DSS and SOC 2",
  healthcare: "HIPAA",
  "public-sector": "data residency and accessibility requirements",
};

const PROJECT_TYPE_SECTIONS: Record<string, string> = {
  "data-warehouse":
    "## Data Pipeline: the sources, how often each is ingested (batch or streaming, and how frequently), the transformation layers (for example raw, cleaned, curated), and the data quality checks at each layer.",
  "ml-platform":
    "## Model Lifecycle: training (data, schedule, compute), evaluation (metrics and the bar a model must pass), the model registry and versioning, deployment and rollback, and monitoring including data and prediction drift.",
  "cicd-pipeline":
    "## Deployment Pipeline: the stages in order, the environments, the approvals needed to promote a release, and how a release is rolled back.",
};

/**
 * Extra instructions for the spec generator (spec 46), or "" when no design context is set, so a
 * project without context gets exactly the standard structure.
 */
export function buildSpecContextSections(ctx: DesignContext): string {
  const summary = formatDesignContext(ctx);
  if (!summary) return "";

  const sections: string[] = [];
  const provider = ctx.cloudProvider;
  if (provider === "aws" || provider === "azure" || provider === "gcp") {
    const name = PROVIDER_NAMES[provider];
    sections.push(
      `## Cloud Services: a table with the columns Component | Managed service | Why it was chosen, one row per component that runs on a managed ${name} service. Use the node's managed service where the canvas lists one; otherwise propose a managed ${name} service and mark it "(proposed)".`
    );
  }
  const frameworks = COMPLIANCE_FRAMEWORKS[ctx.industry ?? ""];
  if (frameworks) {
    sections.push(
      `## Compliance and Data Protection: the frameworks that apply (${frameworks}), which components are in scope (use the boundaries where the canvas has them), and the controls the design requires: encryption in transit and at rest, audit logging, access control, and data retention. List required controls only: don't state or imply that the system is certified or compliant, and don't name certifications the design doesn't support.`
    );
  }
  const projectSection = PROJECT_TYPE_SECTIONS[ctx.projectType ?? ""];
  if (projectSection) sections.push(projectSection);

  return [
    `Design context: ${summary}`,
    "Adjust the structure for this context:",
    `- Directly under the title, add this line: **Context:** ${summary}`,
    ...(sections.length
      ? [
          "- Add these sections after Non-Functional Requirements and before Assumptions and Open Questions, in this order:",
          ...sections.map((section) => `  ${section}`),
        ]
      : []),
  ].join("\n");
}
