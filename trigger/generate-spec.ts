import { randomUUID } from "node:crypto";

import { google } from "@ai-sdk/google";
import { AbortTaskRunError, logger, metadata, schemaTask } from "@trigger.dev/sdk";
import { del, put } from "@vercel/blob";
import { generateText } from "ai";

import { boundaryMembers } from "@/lib/boundaries";
import { getCloudService, serviceFullName } from "@/lib/cloud-services";
import { EMPTY_DESIGN_CONTEXT } from "@/lib/design-context";
import { buildSpecContextSections } from "@/lib/design-context-prompts";
import { prisma } from "@/lib/prisma";
import { specBlobPath } from "@/lib/project-spec";
import { generateSpecPayloadSchema, type GenerateSpecPayload, type TaskStatus } from "@/types/tasks";

// Same Gemini model the design agent used before it moved to OpenAI.
const MODEL_ID = "gemini-3.5-flash";
// A full spec is a long answer, so this allows more time than a design plan.
const SPEC_TIMEOUT_MS = 180_000;

const SYSTEM_PROMPT = `You are MindMesh, a senior system architect. Write the technical specification for a system a team designed on a shared canvas, using the canvas graph and the team's chat.

Use this structure:
# <System name> Technical Specification
## Overview: purpose and scope in a short paragraph.
## Architecture: how the parts fit together, following the main request path.
## Components: one ### subsection per canvas node with its responsibility, what it talks to, and the data it owns.
## Data Flows: numbered steps for each main flow, following the edges.
## Data Storage: each data store, what it holds, and who reads or writes it.
## Non-Functional Requirements: scalability, availability, security and observability as they apply to this design.
## Assumptions and Open Questions: what you inferred that the canvas and chat don't state, and decisions still to make.

When the request gives a design context, also add the line and sections it asks for, where it says; keep the sections above in the same order.

Rules:
- The canvas is the source of truth. Cover every node and edge, and don't add components that aren't on it. Ideas from the chat that aren't on the canvas go under open questions.
- Use component names exactly as labeled. Call an unlabeled node by its shape, like "unlabeled cylinder".
- Mark anything you infer as an assumption.
- Boundaries (when listed) are zones, not components: describe each one and the components inside it in the Architecture section, don't give it a Components subsection, and use them in the security and compliance discussion (for example, what is in PCI scope).
- Output only the Markdown document: no preamble, and no code fence around it.`;

export const generateSpec = schemaTask({
  id: "generate-spec",
  schema: generateSpecPayloadSchema,
  // The config's default retries apply (they're off in dev): a failed attempt leaves no record and
  // no file behind (see saveSpec), so a retry can't produce duplicates.
  run: async (payload) => {
    // Read by the browser through a run-scoped token for realtime progress.
    const setStatus = (status: TaskStatus) => metadata.set("status", status);

    try {
      setStatus("processing");
      const { text } = await generateText({
        model: google(MODEL_ID), // google() reads GOOGLE_GENERATIVE_AI_API_KEY.
        system: SYSTEM_PROMPT,
        prompt: describeContext(payload),
        abortSignal: AbortSignal.timeout(SPEC_TIMEOUT_MS),
      });
      const spec = unwrapFence(text);
      if (!spec) throw new Error("The model returned an empty spec");

      const specId = await saveSpec(payload.projectId, spec);
      // The output stays plain Markdown; the browser finds the saved spec's ID here.
      metadata.set("specId", specId);
      setStatus("completed");
      logger.info("Spec generated and saved", { projectId: payload.projectId, specId, characters: spec.length });
      return spec;
    } catch (err) {
      logger.error("Spec generation failed", { error: err instanceof Error ? err.message : String(err) });
      setStatus("failed");
      // Rethrown so the run shows as failed (and retries where enabled).
      throw err;
    }
  },
});

// Same split as the canvas: Markdown in private Vercel Blob, its URL in the database.
async function saveSpec(projectId: string, spec: string) {
  // A project being deleted has already had its spec files removed, so don't add one behind it.
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletionPending: false },
    select: { id: true },
  });
  if (!project) throw new AbortTaskRunError("The project was deleted before the spec could be saved");

  const specId = randomUUID();
  const { url } = await put(specBlobPath(projectId, specId), spec, {
    access: "private",
    addRandomSuffix: false,
    contentType: "text/markdown; charset=utf-8",
  });
  try {
    await prisma.projectSpec.create({ data: { id: specId, projectId, filePath: url } });
  } catch (err) {
    // Without its record nothing can reach or clean up the file.
    await del(url).catch((delErr) => logger.warn("Couldn't delete unsaved spec file", { url, error: String(delErr) }));
    throw err;
  }
  return specId;
}

function describeContext({ nodes, edges, chatHistory, designContext }: GenerateSpecPayload) {
  const names = new Map(
    nodes.map((node) => [node.id, node.data.label.trim() || `unlabeled ${node.data.shape}`])
  );
  const nameOf = (id: string) => names.get(id) ?? id;

  // A boundary is a group outline (spec 68), described by what it contains rather than as a component.
  const components = nodes.filter((node) => node.data.shape !== "boundary");
  const boundaries = nodes.filter((node) => node.data.shape === "boundary");

  const nodeLines = components.map((node) => {
    const service = getCloudService(node.data.service);
    const managed = service ? `, managed service: ${serviceFullName(service)}` : "";
    return `- ${nameOf(node.id)} (${node.data.shape}${managed})`;
  });
  const boundaryLines = boundaries.map((boundary) => {
    const members = boundaryMembers(boundary, components).map((node) => nameOf(node.id));
    return `- ${nameOf(boundary.id)}: ${members.length ? members.join(", ") : "(no components inside)"}`;
  });
  const edgeLines = edges.map((edge) => {
    const label = edge.data?.label?.trim();
    return `- ${nameOf(edge.source)} -> ${nameOf(edge.target)}${label ? `: ${label}` : ""}`;
  });
  const chatLines = chatHistory.map(
    (message) => `${message.sender.name} (${message.role}): ${message.content}`
  );
  // Fields the payload omits count as not set; "" when no context is set.
  const contextSections = buildSpecContextSections({ ...EMPTY_DESIGN_CONTEXT, ...designContext });

  return [
    `Canvas nodes (${components.length}):`,
    ...nodeLines,
    "",
    ...(boundaryLines.length
      ? [
          `Boundaries (${boundaryLines.length}) — groups such as security, network, or compliance zones, not components; boundary: components inside:`,
          ...boundaryLines,
          "",
        ]
      : []),
    `Canvas edges (${edges.length}), source -> target: interaction:`,
    ...(edgeLines.length ? edgeLines : ["(none)"]),
    "",
    "Team chat, oldest first:",
    ...(chatLines.length ? chatLines : ["(none)"]),
    ...(contextSections ? ["", contextSections] : []),
  ].join("\n");
}

// Models sometimes wrap the whole answer in a ```markdown fence despite the instructions.
function unwrapFence(text: string) {
  const trimmed = text.trim();
  const match = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  return (match ? match[1] : trimmed).trim();
}
