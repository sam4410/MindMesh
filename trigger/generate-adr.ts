import { google } from "@ai-sdk/google";
import { logger, metadata, schemaTask } from "@trigger.dev/sdk";
import { generateText } from "ai";

import { EMPTY_DESIGN_CONTEXT, formatDesignContext } from "@/lib/design-context";
import { describeCanvasAndChat, unwrapFence } from "@/lib/document-prompt";
import { saveProjectDocument } from "@/lib/project-spec-store";
import { generateSpecPayloadSchema, type GenerateSpecPayload, type TaskStatus } from "@/types/tasks";

// Same Gemini model as generate-spec.
const MODEL_ID = "gemini-3.5-flash";
// Up to eight records is about as long as a spec.
const ADR_TIMEOUT_MS = 180_000;

const SYSTEM_PROMPT = `You are MindMesh, a senior system architect. Write architecture decision records (ADRs) for a system a team designed on a shared canvas, using the canvas graph and the team's chat.

Find the 3 to 8 most significant architectural decisions, for example the choice of database, messaging or event streaming, cloud and managed services, synchronous versus asynchronous communication, or how the system is split into services. Skip minor choices.

Write one Markdown document with this structure:
# <System name> Architecture Decision Records
Then one record per decision, numbered from 1, each exactly like this:
## ADR-<n>: <short title naming the decision>
**Status:** Accepted
### Context
The problem or forces that called for a decision.
### Decision
What was chosen, naming the components involved.
### Alternatives considered
A bullet list of realistic options that weren't chosen, each with why.
### Consequences
A bullet list of what follows from the decision, both the benefits and the costs or risks.

Rules:
- Take decisions from the team's chat where the team discussed them, and check them against the canvas, which is the source of truth for what was built.
- If the chat has no clear decisions, record the decisions visible in the design instead, and say in each such record's Context that it was inferred from the design rather than discussed.
- Use component names exactly as labeled. Call an unlabeled node by its shape, like "unlabeled cylinder".
- Boundaries (when listed) are zones such as security or compliance scopes, not components.
- Don't invent requirements, numbers or reasons the canvas and chat don't support; mark what you infer.
- Output only the Markdown document: no preamble, and no code fence around it.`;

export const generateAdr = schemaTask({
  id: "generate-adr",
  // The same payload as generate-spec (spec 58).
  schema: generateSpecPayloadSchema,
  // Like generate-spec: a failed attempt leaves no record and no file behind, so retries can't duplicate.
  run: async (payload) => {
    // Read by the browser through a run-scoped token for realtime progress.
    const setStatus = (status: TaskStatus) => metadata.set("status", status);

    try {
      setStatus("processing");
      const { text } = await generateText({
        model: google(MODEL_ID), // google() reads GOOGLE_GENERATIVE_AI_API_KEY.
        system: SYSTEM_PROMPT,
        prompt: describeContext(payload),
        abortSignal: AbortSignal.timeout(ADR_TIMEOUT_MS),
      });
      const adr = unwrapFence(text);
      // Without a single record the answer isn't a decision log, so don't save it.
      if (!/^## ADR-\d+:/m.test(adr)) throw new Error("The model returned no decision records");

      const specId = await saveProjectDocument(payload.projectId, adr, "ADR");
      // As with specs: the output is the Markdown, and the browser finds the saved ID here.
      metadata.set("specId", specId);
      setStatus("completed");
      logger.info("ADRs generated and saved", {
        projectId: payload.projectId,
        specId,
        records: adr.match(/^## ADR-\d+:/gm)?.length ?? 0,
        characters: adr.length,
      });
      return adr;
    } catch (err) {
      logger.error("ADR generation failed", { error: err instanceof Error ? err.message : String(err) });
      setStatus("failed");
      // Rethrown so the run shows as failed (and retries where enabled).
      throw err;
    }
  },
});

function describeContext(payload: GenerateSpecPayload) {
  // Fields the payload omits count as not set; "" when no context is set.
  const summary = formatDesignContext({ ...EMPTY_DESIGN_CONTEXT, ...payload.designContext });
  return [
    ...describeCanvasAndChat(payload),
    ...(summary
      ? ["", `Design context: ${summary}. Weigh each decision and its alternatives against this context.`]
      : []),
  ].join("\n");
}
