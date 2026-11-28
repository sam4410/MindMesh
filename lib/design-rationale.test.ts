// Self-check for lib/design-rationale.ts: node --import tsx --test lib/design-rationale.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { designRunMessage } from "./ai-status";
import { decisionIdsFor, decisionRecords, nodeRationale, readRationale, type PlannedDecision } from "./design-rationale";

const decision = (id: string, nodeIds: string[], extra: Partial<PlannedDecision> = {}): PlannedDecision => ({
  id,
  title: `Decision ${id}`,
  choice: "Use Postgres",
  reasons: ["Relational orders"],
  alternatives: ["Cosmos DB"],
  tradeoffs: "Harder to scale writes.",
  nodeIds,
  sourceUrls: [],
  ...extra,
});

// The model's temporary ids map to canvas ids; "existing-1" is already on the canvas.
const ids = new Map([["n1", "rectangle-abc"]]);
const resolve = (ref: string) => ids.get(ref) ?? ref;

test("links a node to the decisions that list it by temporary or canvas id", () => {
  const decisions = [decision("a", ["n1"]), decision("b", ["existing-1"]), decision("c", ["rectangle-abc", "n2"])];
  assert.deepEqual(decisionIdsFor("rectangle-abc", decisions, resolve), ["a", "c"]);
  assert.deepEqual(decisionIdsFor("existing-1", decisions, resolve), ["b"]);
});

test("cuts text, maps and drops node ids, and keeps only this run's https sources", () => {
  const sources = [
    { title: "Postgres on Azure", url: "https://learn.microsoft.com/postgres" },
    { title: "Plain", url: "http://example.com/plain" },
  ];
  const [record] = decisionRecords(
    [
      decision("a", ["n1", "n1", "gone", "existing-1"], {
        title: "t".repeat(200),
        reasons: [" one ", "", "two", "three", "four"],
        alternatives: ["x".repeat(200)],
        sourceUrls: ["https://learn.microsoft.com/postgres", "http://example.com/plain", "https://invented.example"],
      }),
    ],
    { resolve, nodeExists: (id) => id !== "gone", sources }
  );
  assert.equal(record.title.length, 120);
  assert.deepEqual(record.reasons, ["one", "two", "three"]);
  assert.equal(record.alternatives[0].length, 120);
  assert.deepEqual(record.nodeIds, ["rectangle-abc", "existing-1"]);
  assert.deepEqual(record.sources, [{ title: "Postgres on Azure", url: "https://learn.microsoft.com/postgres" }]);
});

test("keeps at most 8 decisions", () => {
  const many = Array.from({ length: 10 }, (_, i) => decision(String(i), []));
  assert.equal(decisionRecords(many, { resolve, nodeExists: () => true, sources: [] }).length, 8);
});

test("records the node's label and service, and reads back only well-formed rationales", () => {
  const data = { label: "Orders DB", color: "#0F2E18", shape: "cylinder" as const, service: "azure.postgres" };
  const rationale = nodeRationale(data, `  ${"r".repeat(600)}  `, ["a"], "run-1", "2026-11-27T10:00:00.000Z");
  assert.equal(rationale.reason.length, 500);
  assert.equal(rationale.recordedService, "azure.postgres");
  assert.deepEqual(readRationale(rationale), rationale);
  assert.equal(readRationale({ ...rationale, reason: "   " }), null);
  assert.equal(readRationale({ ...rationale, recordedAt: "yesterday" }), null);
  assert.equal(readRationale("<script>"), null);
});

test("the chat reply lists key decisions after the summary and before the sources", () => {
  const message = designRunMessage(
    {
      isCompleted: true,
      isSuccess: true,
      output: {
        applied: 3,
        skipped: 0,
        decisions: Array.from({ length: 6 }, (_, i) => ({ title: `T${i}`, choice: `C${i}` })),
        sources: [{ title: "Doc", url: "https://learn.microsoft.com/doc" }],
      },
    },
    undefined,
    { status: "completed", text: "Designed it." }
  );
  assert.equal(
    message,
    "Designed it.\n\nKey decisions:\n- T0: C0\n- T1: C1\n- T2: C2\n- T3: C3\n- T4: C4\n\nSources:\n- Doc (https://learn.microsoft.com/doc)"
  );
});
