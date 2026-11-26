// Self-check for lib/cost-estimate.ts: node --import tsx --test lib/cost-estimate.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { finalizeCostEstimate, isPricedProvider } from "./cost-estimate";

const item = (nodeId: string, monthlyLow: number, monthlyHigh: number) => ({
  nodeId,
  service: "Azure Functions",
  tier: "Consumption",
  monthlyLow,
  monthlyHigh,
  assumption: "1M executions",
});

test("drops unknown node IDs and recomputes totals from the line items", () => {
  const result = finalizeCostEstimate(
    {
      currency: "USD",
      lineItems: [item("api", 10.1, 20.2), item("db", 100, 250.556), item("ghost", 999, 9999), item("db", 5, 5)],
      unpricedNodeIds: ["client", "client", "ghost", "api"],
      totalLow: 1,
      totalHigh: 2,
      caveats: ["Excludes support plans"],
    },
    new Set(["api", "db", "client"])
  );
  assert.deepEqual(
    result.lineItems.map(({ nodeId, monthlyLow, monthlyHigh }) => [nodeId, monthlyLow, monthlyHigh]),
    [["api", 10.1, 20.2], ["db", 100, 250.56], ["db", 5, 5]]
  );
  // Priced, unknown and repeated IDs leave the unpriced list.
  assert.deepEqual(result.unpricedNodeIds, ["client"]);
  assert.equal(result.totalLow, 115.1);
  assert.equal(result.totalHigh, 275.76);
  assert.deepEqual(result.caveats, ["Excludes support plans"]);
});

test("swaps a reversed range and handles an estimate with nothing priced", () => {
  const swapped = finalizeCostEstimate(
    { currency: "USD", lineItems: [item("a", 30, 10)], unpricedNodeIds: [], totalLow: 0, totalHigh: 0, caveats: [] },
    new Set(["a"])
  );
  assert.deepEqual([swapped.lineItems[0].monthlyLow, swapped.lineItems[0].monthlyHigh], [10, 30]);
  assert.deepEqual([swapped.totalLow, swapped.totalHigh], [10, 30]);

  const empty = finalizeCostEstimate(
    { currency: "USD", lineItems: [item("gone", 5, 6)], unpricedNodeIds: [], totalLow: 5, totalHigh: 6, caveats: [] },
    new Set(["a"])
  );
  assert.deepEqual([empty.lineItems, empty.totalLow, empty.totalHigh], [[], 0, 0]);
});

test("prices only AWS, Azure and GCP projects", () => {
  for (const provider of ["aws", "azure", "gcp"]) assert.equal(isPricedProvider(provider), true);
  for (const provider of ["agnostic", "on-prem", null, undefined, ""]) assert.equal(isPricedProvider(provider), false);
});
