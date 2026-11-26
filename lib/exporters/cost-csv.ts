import type { CostEstimate } from "@/types/tasks";

// Quotes fields with commas, quotes or line breaks (RFC 4180). Text starting like a formula gets a
// leading apostrophe, since labels come from collaborators and service names from the model.
function csvField(value: string | number) {
  if (typeof value === "number") return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// The Cost tab's table plus a total row (spec 65), with the range as two numeric columns so
// spreadsheets can add them up. labelOf names a line item's node.
export function toCostCsv(estimate: CostEstimate, labelOf: (nodeId: string) => string) {
  const rows: (string | number)[][] = [
    ["Component", "Service", "Tier", "Monthly low (USD)", "Monthly high (USD)"],
    ...estimate.lineItems.map((item) => [labelOf(item.nodeId), item.service, item.tier, item.monthlyLow, item.monthlyHigh]),
    ["Total", "", "", estimate.totalLow, estimate.totalHigh],
  ];
  // The byte order mark makes Excel read the file as UTF-8 (labels may have accents).
  return "﻿" + rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
