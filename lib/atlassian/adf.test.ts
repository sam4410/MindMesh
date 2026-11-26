// Self-check for the Jira description and summary: node --env-file=.env --import tsx --test lib/atlassian/adf.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { buildIssueDescription } from "./adf";
import { issueSummary } from "./jira";

test("description lists the project, service and both connection directions", () => {
  const doc = buildIssueDescription({
    projectName: "Shop",
    label: "Order Queue",
    service: "AWS SQS",
    incoming: ["Order Intake → Order Queue: Publish Order"],
    outgoing: ["Order Queue → Fulfilment: Consume Order", "  "],
  });
  assert.equal(doc.type, "doc");
  assert.equal(doc.version, 1);
  const texts = JSON.stringify(doc);
  assert.ok(texts.includes("Component from the MindMesh design 'Shop'."));
  assert.ok(texts.includes("Service: AWS SQS"));
  assert.ok(texts.includes("Order Intake → Order Queue: Publish Order"));
  const lists = doc.content.filter((node) => node.type === "bulletList");
  assert.equal(lists.length, 2);
  // The blank connection is dropped rather than sent as an empty text node, which ADF rejects.
  assert.equal(lists[1].content.length, 1);
  assert.ok(!texts.includes('"text":""'));
});

test("no service or connections gives just the intro paragraph", () => {
  const doc = buildIssueDescription({ projectName: "Shop", label: "Cache", incoming: [], outgoing: [] });
  assert.equal(doc.content.length, 1);
});

test("summary is one line and within Jira's 255 characters", () => {
  assert.equal(issueSummary("Order\n  Service "), "Implement Order Service");
  assert.equal(issueSummary("x".repeat(400)).length, 255);
});
