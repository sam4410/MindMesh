import { z } from "zod";

import type { CanvasNodeData, NodeRationale } from "@/types/canvas";

// Recorded design reasons (spec 72): no server imports, so the canvas can use readRationale.
export const MAX_DECISIONS = 8;
const MAX_REASON = 500;

const cut = (text: string, max: number) => text.trim().slice(0, max);
// Blank entries dropped, then at most `count` kept, each cut to `max` characters.
const cutList = (items: string[], count: number, max: number) =>
  items.map((item) => cut(item, max)).filter(Boolean).slice(0, count);

// A decision as the plan step stores it: the model's fields plus the id the step gave it.
export interface PlannedDecision {
  id: string;
  title: string;
  choice: string;
  reasons: string[];
  alternatives: string[];
  tradeoffs: string;
  nodeIds: string[];
  sourceUrls: string[];
}

// The rationale stored on a node an action with a reason added or changed; `data` is the node's
// data after the action, so a later label or service change can be flagged.
export function nodeRationale(
  data: CanvasNodeData,
  reason: string,
  decisionIds: string[],
  runId: string,
  recordedAt: string
): NodeRationale {
  return {
    reason: cut(reason, MAX_REASON),
    decisionIds,
    recordedLabel: data.label,
    recordedService: data.service ?? null,
    recordedAt,
    runId,
  };
}

// Ids of the decisions that list the node; `resolve` maps the model's temporary ids to canvas ids.
export function decisionIdsFor(nodeId: string, decisions: PlannedDecision[], resolve: (ref: string) => string) {
  return decisions.filter((d) => d.nodeIds.some((ref) => resolve(ref) === nodeId)).map((d) => d.id);
}

// What gets saved as DesignDecision rows: text cut to its limit rather than rejected, node ids
// mapped and dropped when the node is gone, and sources kept only when they are this run's https
// research sources.
export function decisionRecords(
  decisions: PlannedDecision[],
  {
    resolve,
    nodeExists,
    sources,
  }: {
    resolve: (ref: string) => string;
    nodeExists: (id: string) => boolean;
    sources: readonly { title: string; url: string }[];
  }
) {
  return decisions.slice(0, MAX_DECISIONS).map((d) => ({
    id: d.id,
    title: cut(d.title, 120),
    choice: cut(d.choice, 300),
    reasons: cutList(d.reasons, 3, 300),
    alternatives: cutList(d.alternatives, 3, 120),
    tradeoffs: cut(d.tradeoffs, 300),
    nodeIds: [...new Set(d.nodeIds.map(resolve))].filter(nodeExists).slice(0, 20),
    sources: sources
      .filter((source) => source.url.startsWith("https://") && d.sourceUrls.includes(source.url))
      .map(({ title, url }) => ({ title, url })),
  }));
}

// Node data is written by any collaborator, so the canvas shows a rationale only in this shape.
const nodeRationaleSchema = z.object({
  reason: z.string().trim().min(1).max(MAX_REASON),
  decisionIds: z.array(z.string()).max(MAX_DECISIONS),
  recordedLabel: z.string(),
  recordedService: z.string().nullable(),
  recordedAt: z.iso.datetime(),
  runId: z.string(),
});

export function readRationale(value: unknown): NodeRationale | null {
  const parsed = nodeRationaleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
