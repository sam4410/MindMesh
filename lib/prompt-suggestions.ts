import type { DesignContext } from "@/lib/design-context";

const MAX_SUGGESTIONS = 4;

// The sidebar's original starters, used as-is when no context is set.
const DEFAULT_STARTERS = [
  "Design an e-commerce backend",
  "Create a chat app architecture",
  "Build a CI/CD pipeline",
];

const PROVIDER_SUFFIX: Record<string, string> = {
  aws: " on AWS",
  azure: " on Azure",
  gcp: " on Google Cloud",
  "on-prem": " on-premises",
};

const WAREHOUSE_SERVICE: Record<string, string> = { aws: "Redshift", azure: "Synapse", gcp: "BigQuery" };
const MIGRATION_TARGET: Record<string, string> = { aws: "AWS", azure: "Azure", gcp: "Google Cloud" };

// Starters that reuse a default's wording end up identical to it, so the Set below drops the copy.
function contextStarters({ cloudProvider, architectureStyle, industry, projectType }: DesignContext, on: string) {
  const provider = cloudProvider ?? "";
  const byType: Record<string, string> = {
    "data-warehouse": WAREHOUSE_SERVICE[provider]
      ? `Design a batch and streaming data warehouse on ${WAREHOUSE_SERVICE[provider]}`
      : `Design a batch and streaming data warehouse${on}`,
    "ml-platform": `Design an ML platform with a feature store and model registry${on}`,
    "cicd-pipeline": `${DEFAULT_STARTERS[2]}${on}`,
    "cloud-migration": `Plan a migration from on-premises to ${MIGRATION_TARGET[provider] ?? "the cloud"}`,
    "realtime-app": `${DEFAULT_STARTERS[1]}${on}`,
    "backend-platform": `Design a backend platform${on}`,
  };
  const byIndustry: Record<string, string> = {
    finance: `Design a PCI-compliant payments platform${on}`,
    healthcare: `Design a patient records system with an isolated PHI store${on}`,
    ecommerce: `${DEFAULT_STARTERS[0]}${on}`,
    saas: `Design a multi-tenant SaaS backend${on}`,
    gaming: `Design a real-time multiplayer game backend${on}`,
    "public-sector": `Design a citizen services portal with in-region data${on}`,
  };
  const byStyle: Record<string, string> = {
    monolith: `Design a monolithic web app backend${on}`,
    "modular-monolith": `Design a modular monolith with clear domain modules${on}`,
    microservices: `Design a microservices backend${on}`,
    "event-driven": `Design an event-driven order processing system${on}`,
    serverless: `Design a serverless API${on}`,
    "data-mesh": `Design a data mesh with domain-owned data products${on}`,
  };
  return [byType[projectType ?? ""], byIndustry[industry ?? ""], byStyle[architectureStyle ?? ""]];
}

const REFINEMENTS = {
  industry: {
    finance: "Make the payment flow PCI compliant",
    healthcare: "Add audit logging for patient data access",
    ecommerce: "Add a catalog cache and product search",
    saas: "Isolate tenant data and track usage for billing",
    gaming: "Add matchmaking and a leaderboard",
    "public-sector": "Keep all data in-region and add an audit log",
  },
  architectureStyle: {
    microservices: "Add an API gateway and service-to-service authentication",
    "event-driven": "Add a dead-letter queue for failed events",
    serverless: "Add retries and a dead-letter queue to the functions",
  },
  projectType: {
    "data-warehouse": "Add data quality checks to each pipeline layer",
    "ml-platform": "Add model monitoring for data and prediction drift",
    "cicd-pipeline": "Add a manual approval before production deploys",
    "cloud-migration": "Add data replication and a cutover plan",
    "realtime-app": "Add presence and message history",
  },
} satisfies Partial<Record<keyof DesignContext, Record<string, string>>>;

// Offered for every canvas, after up to two context-specific ones.
const ALWAYS_REFINEMENTS = ["Add monitoring and alerting", "Add disaster recovery across regions"];

/**
 * Prompt chips for the AI sidebar (spec 47): starters for an empty canvas, refinements once it has
 * nodes. Rule-based, at most 4, most specific first.
 */
export function getPromptSuggestions(ctx: DesignContext, hasNodes: boolean): string[] {
  if (hasNodes) {
    const specific = (Object.keys(REFINEMENTS) as (keyof typeof REFINEMENTS)[])
      .map((field) => (REFINEMENTS[field] as Record<string, string>)[ctx[field] ?? ""])
      .filter((prompt): prompt is string => Boolean(prompt));
    return [...specific.slice(0, MAX_SUGGESTIONS - ALWAYS_REFINEMENTS.length), ...ALWAYS_REFINEMENTS];
  }

  const on = PROVIDER_SUFFIX[ctx.cloudProvider ?? ""] ?? "";
  const starters = contextStarters(ctx, on).filter((prompt): prompt is string => Boolean(prompt));
  // Fill with the defaults (on the chosen cloud, if any) so a sparse context still offers a few.
  const all = new Set([...starters, ...DEFAULT_STARTERS.map((prompt) => `${prompt}${on}`)]);
  return [...all].slice(0, starters.length ? MAX_SUGGESTIONS : DEFAULT_STARTERS.length);
}
