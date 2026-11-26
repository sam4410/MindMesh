import type { CloudProvider } from "@/lib/cloud-services";
import type { CostEstimate } from "@/types/tasks";

export const COST_PROVIDER_REQUIRED = "Choose a cloud provider to estimate costs";

// Only AWS, Azure and GCP have list prices to estimate from; "agnostic" and "on-prem" don't.
export function isPricedProvider(provider: string | null | undefined): provider is CloudProvider {
  return provider === "aws" || provider === "azure" || provider === "gcp";
}

const toCents = (value: number) => Math.round(value * 100) / 100;

// Keeps only line items and unpriced IDs for components on the canvas, and recomputes the totals
// from the line items, since the model's own sums aren't trusted (spec 64).
export function finalizeCostEstimate(estimate: CostEstimate, componentIds: ReadonlySet<string>): CostEstimate {
  const lineItems = estimate.lineItems
    .filter((item) => componentIds.has(item.nodeId))
    .map((item) => ({
      ...item,
      monthlyLow: toCents(Math.min(item.monthlyLow, item.monthlyHigh)),
      monthlyHigh: toCents(Math.max(item.monthlyLow, item.monthlyHigh)),
    }));
  const priced = new Set(lineItems.map((item) => item.nodeId));
  return {
    ...estimate,
    lineItems,
    unpricedNodeIds: [...new Set(estimate.unpricedNodeIds)].filter((id) => componentIds.has(id) && !priced.has(id)),
    totalLow: toCents(lineItems.reduce((sum, item) => sum + item.monthlyLow, 0)),
    totalHigh: toCents(lineItems.reduce((sum, item) => sum + item.monthlyHigh, 0)),
  };
}
