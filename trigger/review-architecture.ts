import { openai } from "@ai-sdk/openai";
import { logger, metadata, schemaTask } from "@trigger.dev/sdk";
import { generateText, Output } from "ai";

import { boundaryMembers } from "@/lib/boundaries";
import { getCloudService, serviceFullName } from "@/lib/cloud-services";
import { EMPTY_DESIGN_CONTEXT } from "@/lib/design-context";
import { buildReviewContext } from "@/lib/design-context-prompts";
import {
  reviewPayloadSchema,
  reviewResultSchema,
  type ReviewPayload,
  type ReviewResult,
  type TaskStatus,
} from "@/types/tasks";

// The design agent's model (trigger/design-agent.ts); kept in step by hand so that task stays unchanged.
const MODEL_ID = "gpt-6-luna";
const REVIEW_TIMEOUT_MS = 120_000;

const SYSTEM_PROMPT = `You are MindMesh, a principal cloud architect reviewing a system design a team drew on a shared canvas.

Score the design from 1 to 5 on each pillar (reliability, security, cost, performance, operations) with a short reason, then list concrete findings.

Rules:
- Review only what is on the canvas: its components, managed services, connections and boundaries. Don't assume components that aren't drawn; a missing component is itself a finding.
- Each finding names the problem, why it matters for this design, and one concrete change to the design. Put the most severe findings first, at most 20.
- severity: "high" for a likely outage, data loss or security breach; "medium" for a clear gap against best practice; "low" for an improvement.
- nodeIds: the IDs (in square brackets in the node list) of the nodes a finding is about; an empty list when it's about the design as a whole.
- Boundaries are zones such as PCI scope or a network segment, not components; use them when judging isolation and compliance scope.
- Don't state or imply that the system is certified or compliant with any framework.`;

export const reviewArchitecture = schemaTask({
  id: "review-architecture",
  schema: reviewPayloadSchema,
  // A retry would run (and bill) the model call again.
  retry: { maxAttempts: 1 },
  run: async (payload): Promise<ReviewResult> => {
    // Read by the browser through a run-scoped token for realtime progress, like generate-spec.
    const setStatus = (status: TaskStatus) => metadata.set("status", status);

    try {
      setStatus("processing");
      const { output } = await generateText({
        model: openai(MODEL_ID), // openai() reads OPENAI_API_KEY.
        system: SYSTEM_PROMPT,
        prompt: describeDesign(payload),
        output: Output.object({ schema: reviewResultSchema }),
        abortSignal: AbortSignal.timeout(REVIEW_TIMEOUT_MS),
      });

      // Findings may only point at nodes that are on the canvas.
      const nodeIds = new Set(payload.nodes.map((node) => node.id));
      let dropped = 0;
      const review: ReviewResult = {
        ...output,
        findings: output.findings.map((finding) => {
          const kept = finding.nodeIds.filter((id) => nodeIds.has(id));
          dropped += finding.nodeIds.length - kept.length;
          return { ...finding, nodeIds: [...new Set(kept)] };
        }),
      };

      setStatus("completed");
      logger.info("Architecture reviewed", {
        projectId: payload.projectId,
        scores: Object.fromEntries(review.pillars.map((entry) => [entry.pillar, entry.score])),
        findings: review.findings.length,
        droppedNodeIds: dropped,
      });
      return review;
    } catch (err) {
      logger.error("Architecture review failed", { error: err instanceof Error ? err.message : String(err) });
      setStatus("failed");
      throw err;
    }
  },
});

// The canvas as text, with node IDs so findings can point at nodes.
function describeDesign({ nodes, edges, designContext }: ReviewPayload) {
  const names = new Map(nodes.map((node) => [node.id, node.data.label.trim() || `unlabeled ${node.data.shape}`]));
  const nameOf = (id: string) => names.get(id) ?? id;

  const components = nodes.filter((node) => node.data.shape !== "boundary");
  const boundaries = nodes.filter((node) => node.data.shape === "boundary");

  const nodeLines = components.map((node) => {
    const service = getCloudService(node.data.service);
    const managed = service ? `, managed service: ${serviceFullName(service)}` : "";
    return `- [${node.id}] ${nameOf(node.id)} (${node.data.shape}${managed})`;
  });
  const boundaryLines = boundaries.map((boundary) => {
    const members = boundaryMembers(boundary, components).map((node) => nameOf(node.id));
    return `- [${boundary.id}] ${nameOf(boundary.id)}: ${members.length ? members.join(", ") : "(no components inside)"}`;
  });
  const edgeLines = edges.map((edge) => {
    const label = edge.data?.label?.trim();
    return `- ${nameOf(edge.source)} -> ${nameOf(edge.target)}${label ? `: ${label}` : ""}`;
  });

  return [
    // Fields the payload omits count as not set.
    buildReviewContext({ ...EMPTY_DESIGN_CONTEXT, ...designContext }),
    "",
    `Canvas nodes (${components.length}), [id] name (shape):`,
    ...nodeLines,
    "",
    ...(boundaryLines.length ? [`Boundaries (${boundaryLines.length}), [id] name: components inside:`, ...boundaryLines, ""] : []),
    `Canvas edges (${edges.length}), source -> target: interaction:`,
    ...(edgeLines.length ? edgeLines : ["(none)"]),
  ].join("\n");
}
