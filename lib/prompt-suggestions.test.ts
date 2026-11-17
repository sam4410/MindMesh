// Self-check for spec 47. Run: node --import tsx --test lib/prompt-suggestions.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { EMPTY_DESIGN_CONTEXT, type DesignContext } from "./design-context";
import { getPromptSuggestions } from "./prompt-suggestions";

const ctx = (fields: Partial<DesignContext>) => ({ ...EMPTY_DESIGN_CONTEXT, ...fields });

test("no context keeps the original three starters", () => {
  assert.deepEqual(getPromptSuggestions(EMPTY_DESIGN_CONTEXT, false), [
    "Design an e-commerce backend",
    "Create a chat app architecture",
    "Build a CI/CD pipeline",
  ]);
});

test("finance on Azure starts with a PCI payments platform", () => {
  const suggestions = getPromptSuggestions(ctx({ cloudProvider: "azure", industry: "finance" }), false);
  assert.equal(suggestions[0], "Design a PCI-compliant payments platform on Azure");
  assert.ok(suggestions.length <= 4);
});

test("a GCP data warehouse names BigQuery", () => {
  const suggestions = getPromptSuggestions(ctx({ cloudProvider: "gcp", projectType: "data-warehouse" }), false);
  assert.equal(suggestions[0], "Design a batch and streaming data warehouse on BigQuery");
});

test("a canvas with nodes gets refinements, context-specific first", () => {
  assert.deepEqual(getPromptSuggestions(EMPTY_DESIGN_CONTEXT, true), [
    "Add monitoring and alerting",
    "Add disaster recovery across regions",
  ]);
  const suggestions = getPromptSuggestions(ctx({ industry: "finance", architectureStyle: "microservices" }), true);
  assert.deepEqual(suggestions, [
    "Make the payment flow PCI compliant",
    "Add an API gateway and service-to-service authentication",
    "Add monitoring and alerting",
    "Add disaster recovery across regions",
  ]);
});
