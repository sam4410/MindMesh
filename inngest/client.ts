import { eventType, Inngest, staticSchema } from "inngest";

// Cloud mode by default, which needs INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY (set in Vercel by the
// Inngest integration). Local runs set INNGEST_DEV=1 and use `npx inngest-cli@latest dev`.
export const inngest = new Inngest({
  id: "mindmesh",
  // Off, so each step gets its own request and the 300-second Vercel limit applies per step rather
  // than to several steps run back to back in one request.
  checkpointing: false,
});

// Every AI run carries only its ID; the payload is stored on its TaskRun row (lib/task-runs.ts).
type RunEvent = { runId: string };

export const designRequested = eventType("ai/design.requested", { schema: staticSchema<RunEvent>() });
export const specRequested = eventType("ai/spec.requested", { schema: staticSchema<RunEvent>() });
export const adrRequested = eventType("ai/adr.requested", { schema: staticSchema<RunEvent>() });
export const reviewRequested = eventType("ai/review.requested", { schema: staticSchema<RunEvent>() });
export const costRequested = eventType("ai/cost.requested", { schema: staticSchema<RunEvent>() });
export const iacRequested = eventType("ai/iac.requested", { schema: staticSchema<RunEvent>() });
