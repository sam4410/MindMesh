import { google } from "@ai-sdk/google";
import { generateText } from "ai";

import { inngest, specRequested } from "@/inngest/client";

import { EMPTY_DESIGN_CONTEXT } from "@/lib/design-context";
import { buildSpecContextSections } from "@/lib/design-context-prompts";
import { describeCanvasAndChat, repositoryInstruction, unwrapFence } from "@/lib/document-prompt";
import { saveProjectDocument } from "@/lib/project-spec-store";
import { completeTaskRun, failTaskRun, loadRunInput } from "@/lib/task-runs";
import { generateSpecPayloadSchema, type GenerateSpecPayload } from "@/types/tasks";

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

export const generateSpec = inngest.createFunction(
  {
    id: "generate-spec",
    triggers: [specRequested],
    // Three attempts in all: a failed attempt leaves no record and no file behind (see
    // saveProjectDocument), so a retry can't produce duplicates.
    retries: 2,
    onFailure: async ({ event, error }) => {
      console.error("Spec generation failed", { error: error.message });
      await failTaskRun(event.data.event.data.runId);
    },
  },
  async ({ event, step }) => {
    const { runId } = event.data;
    const specId = await step.run("generate", async () => {
      const payload = await loadRunInput(runId, generateSpecPayloadSchema);
      const { text } = await generateText({
        model: google(MODEL_ID), // google() reads GOOGLE_GENERATIVE_AI_API_KEY.
        system: SYSTEM_PROMPT,
        prompt: describeContext(payload),
        abortSignal: AbortSignal.timeout(SPEC_TIMEOUT_MS),
      });
      const spec = unwrapFence(text);
      if (!spec) throw new Error("The model returned an empty spec");

      const specId = await saveProjectDocument(payload.projectId, spec, "SPEC");
      console.info("Spec generated and saved", { projectId: payload.projectId, specId, characters: spec.length });
      return specId;
    });
    // The Specs tab reloads its list; the Markdown stays in Blob.
    await step.run("finish", () => completeTaskRun(runId, { specId }));
    return { specId };
  }
);

function describeContext(payload: GenerateSpecPayload) {
  // Fields the payload omits count as not set; "" when no context is set.
  const contextSections = buildSpecContextSections({ ...EMPTY_DESIGN_CONTEXT, ...payload.designContext });
  return [
    ...describeCanvasAndChat(payload),
    ...repositoryInstruction(payload.repositoryUrl),
    ...(contextSections ? ["", contextSections] : []),
  ].join("\n");
}
