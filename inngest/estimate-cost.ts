import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { NonRetriableError } from "inngest";

import { costRequested, inngest } from "@/inngest/client";

import { getCloudService, serviceFullName, type CloudProvider } from "@/lib/cloud-services";
import { CLOUD_PROVIDERS, EMPTY_DESIGN_CONTEXT, formatDesignContext } from "@/lib/design-context";
import { COST_PROVIDER_REQUIRED, finalizeCostEstimate, isPricedProvider } from "@/lib/cost-estimate";
import { completeTaskRun, failTaskRun, loadRunInput } from "@/lib/task-runs";
import {
  costEstimateSchema,
  costPayloadSchema,
  type CostAssumptions,
  type CostEstimate,
  type CostPayload,
} from "@/types/tasks";

// The review's model (inngest/review-architecture.ts); kept in step by hand.
const MODEL_ID = "gpt-6-luna";
const COST_TIMEOUT_MS = 120_000;

const TRAFFIC_TIERS: Record<CostAssumptions["trafficTier"], string> = {
  small: "about 10k requests/day and under 50 GB of data",
  medium: "about 1M requests/day and under 1 TB of data",
  large: "about 50M requests/day and under 20 TB of data",
};

// shortcut: model-based list-price ranges, not cloud pricing APIs; switch to the Azure Retail Prices
// API and the AWS Price List API if customers need exact numbers.
const SYSTEM_PROMPT = `You are MindMesh, a cloud cost analyst. Estimate the monthly cost, in US dollars, of a system design a team drew on a shared canvas.

Rules:
- Use the provider's on-demand list prices for the given region. No discounts, free tiers, savings plans, or reserved or committed-use pricing.
- Give each billable component a low-high monthly range, sized for the traffic tier, and state the sizing behind it explicitly in assumption: instance size or SKU, instance count, storage, requests and data transfer.
- When a node names a managed service, price that service. Otherwise pick the provider's typical managed service for the node's role and say so in assumption.
- nodeId: the ID in square brackets in the node list; never invent one. A component may need more than one line item (for example compute and storage).
- unpricedNodeIds: components that aren't billable cloud services, such as users, browsers, mobile apps and third-party systems.
- totalLow and totalHigh: the sums of the line items' monthlyLow and monthlyHigh.
- caveats: what the estimate leaves out or what would change it most, such as data transfer between regions, support plans, licences, taxes and traffic beyond the tier.
- This is a rough estimate from list prices, not a quote.`;

export const estimateCost = inngest.createFunction(
  {
    id: "estimate-cost",
    triggers: [costRequested],
    // A retry would run (and bill) the model call again, as for the review.
    retries: 0,
    onFailure: async ({ event, error }) => {
      console.error("Cost estimate failed", { error: error.message });
      await failTaskRun(event.data.event.data.runId);
    },
  },
  async ({ event, step }) => {
    const { runId } = event.data;
    const estimate = await step.run("estimate", async (): Promise<CostEstimate> => {
      const payload = await loadRunInput(runId, costPayloadSchema);
      // POST /api/ai/cost checks this too; the provider may have changed since, but the payload is what's priced.
      const provider = payload.designContext.cloudProvider;
      if (!isPricedProvider(provider)) throw new NonRetriableError(COST_PROVIDER_REQUIRED);

      const { output } = await generateText({
        model: openai(MODEL_ID), // openai() reads OPENAI_API_KEY.
        system: SYSTEM_PROMPT,
        prompt: describeDesign(payload, provider),
        output: Output.object({ schema: costEstimateSchema }),
        abortSignal: AbortSignal.timeout(COST_TIMEOUT_MS),
      });

      const estimate = finalizeCostEstimate(output, new Set(components(payload).map((node) => node.id)));
      console.info("Cost estimated", {
        projectId: payload.projectId,
        lineItems: estimate.lineItems.length,
        droppedLineItems: output.lineItems.length - estimate.lineItems.length,
        unpriced: estimate.unpricedNodeIds.length,
        totalLow: estimate.totalLow,
        totalHigh: estimate.totalHigh,
      });
      return estimate;
    });
    // Estimates aren't persisted (spec 64); the browser reads this one from the run.
    await step.run("finish", () => completeTaskRun(runId, estimate));
    return estimate;
  }
);

// Boundaries are zones, not billable components.
const components = ({ nodes }: CostPayload) => nodes.filter((node) => node.data.shape !== "boundary");

// The canvas and assumptions as text, with node IDs so line items can point at nodes.
function describeDesign(payload: CostPayload, provider: CloudProvider) {
  const { nodes, edges, designContext, assumptions } = payload;
  const names = new Map(nodes.map((node) => [node.id, node.data.label.trim() || `unlabeled ${node.data.shape}`]));
  const nameOf = (id: string) => names.get(id) ?? id;
  const providerLabel = CLOUD_PROVIDERS.find((option) => option.id === provider)?.label ?? provider;
  // Fields the payload omits count as not set.
  const summary = formatDesignContext({ ...EMPTY_DESIGN_CONTEXT, ...designContext });

  const nodeLines = components(payload).map((node) => {
    const service = getCloudService(node.data.service);
    const managed = service ? `, managed service: ${serviceFullName(service)}` : "";
    return `- [${node.id}] ${nameOf(node.id)} (${node.data.shape}${managed})`;
  });
  const edgeLines = edges.map((edge) => {
    const label = edge.data?.label?.trim();
    return `- ${nameOf(edge.source)} -> ${nameOf(edge.target)}${label ? `: ${label}` : ""}`;
  });

  return [
    `Cloud provider: ${providerLabel}`,
    `Region: ${assumptions.region}`,
    `Traffic tier: ${assumptions.trafficTier} (${TRAFFIC_TIERS[assumptions.trafficTier]})`,
    `Project context: ${summary}`,
    "",
    `Canvas nodes (${nodeLines.length}), [id] name (shape):`,
    ...nodeLines,
    "",
    `Canvas edges (${edges.length}), source -> target: interaction:`,
    ...(edgeLines.length ? edgeLines : ["(none)"]),
  ].join("\n");
}
