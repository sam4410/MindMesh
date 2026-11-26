// Self-check for lib/exporters/cost-csv.ts: node --import tsx --test lib/exporters/cost-csv.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { toCostCsv } from "@/lib/exporters/cost-csv";

test("exports the table plus a total row, quoting fields that need it", () => {
  const labels: Record<string, string> = { api: "Web, API", db: 'Orders "primary" DB', fn: "=HYPERLINK(1)" };
  const csv = toCostCsv(
    {
      currency: "USD",
      lineItems: [
        { nodeId: "api", service: "Azure API Management", tier: "Standard", monthlyLow: 120, monthlyHigh: 340, assumption: "" },
        { nodeId: "db", service: "Azure SQL Database", tier: "General Purpose\n2 vCores", monthlyLow: 380.5, monthlyHigh: 760, assumption: "" },
        { nodeId: "fn", service: "Azure Functions", tier: "Consumption", monthlyLow: 0, monthlyHigh: 12.25, assumption: "" },
      ],
      unpricedNodeIds: [],
      totalLow: 500.5,
      totalHigh: 1112.25,
      caveats: [],
    },
    (id) => labels[id]
  );

  assert.ok(csv.startsWith("﻿"));
  assert.deepEqual(csv.slice(1).split("\r\n"), [
    "Component,Service,Tier,Monthly low (USD),Monthly high (USD)",
    '"Web, API",Azure API Management,Standard,120,340',
    '"Orders ""primary"" DB",Azure SQL Database,"General Purpose\n2 vCores",380.5,760',
    "'=HYPERLINK(1),Azure Functions,Consumption,0,12.25",
    "Total,,,500.5,1112.25",
    "",
  ]);
});
