import { z } from "zod";

import { EMPTY_DESIGN_CONTEXT, designContextSchema } from "@/lib/design-context";
import { IAC_FORMATS } from "@/lib/iac-bundle";
import { NODE_SHAPES } from "@/types/canvas";

// One Liveblocks feed per room for background task activity: design now, spec generation later.
export const AI_STATUS_FEED_ID = "ai-status-feed";

export const TASK_STATUSES = ["started", "processing", "completed", "failed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// Feed messages come from the room, so the sidebar validates each one with this before showing it.
export const taskStatusMessageSchema = z.object({
  status: z.enum(TASK_STATUSES),
  text: z.string().optional(),
});

export type TaskStatusMessage = z.infer<typeof taskStatusMessageSchema>;

// Room chat in the AI sidebar. Kept apart from AI_STATUS_FEED_ID so progress updates never mix with chat.
export const AI_CHAT_FEED_ID = "ai-chat";
export const CHAT_MESSAGE_MAX_LENGTH = 4000;

// Chat messages are written by browsers in the room, so they're validated before rendering.
export const chatMessageSchema = z.object({
  // shortcut: the sender is what the writing browser claims, so a room member could post under
  // another member's name; stamp it server-side if collaborators can't be trusted with that.
  sender: z.object({ id: z.string().min(1), name: z.string().min(1) }),
  // "assistant" is reserved for AI replies in a later feature.
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
  // When the sender wrote it, in milliseconds since the epoch.
  timestamp: z.number().int().positive(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

// The design agent's input, stored on its TaskRun row by POST /api/ai/design, which validates the
// request itself; designContext comes from the project record.
export const designPayloadSchema = z.object({
  prompt: z.string().min(1),
  roomId: z.string().min(1),
  // Fields the payload omits count as not set.
  designContext: designContextSchema.transform((context) => ({ ...EMPTY_DESIGN_CONTEXT, ...context })),
  // Research official best practices before designing (spec 70).
  research: z.boolean(),
  // Selected canvas nodes the request is about (spec 48); IDs no longer on the canvas are ignored.
  focusNodeIds: z.array(z.string()),
});

// Spec generation input comes from the browser, so the route and the task both validate it.
// Only what a spec needs is kept; other node and edge fields (position, size, color) are stripped.
// shortcut: these caps fit a single-page diagram and conversation; raise them if real projects hit them.
const SPEC_MAX_NODES = 500;
const SPEC_MAX_EDGES = 1000;
export const SPEC_MAX_CHAT_MESSAGES = 200;
const SPEC_MAX_LABEL_LENGTH = 500;

const specNodeSchema = z.object({
  id: z.string().min(1),
  // Geometry, used to work out which components sit inside a boundary.
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  data: z.object({
    label: z.string().max(SPEC_MAX_LABEL_LENGTH),
    shape: z.enum(NODE_SHAPES),
    // Managed cloud service ID (lib/cloud-services.ts); unknown IDs are ignored when describing the node.
    service: z.string().max(80).optional(),
  }),
});

const specEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  // Edges created before labels existed have no data.
  data: z.object({ label: z.string().max(SPEC_MAX_LABEL_LENGTH).optional() }).optional(),
});

export const specRequestSchema = z.object({
  roomId: z.string().min(1),
  chatHistory: z.array(chatMessageSchema).max(SPEC_MAX_CHAT_MESSAGES),
  nodes: z.array(specNodeSchema).min(1, "The canvas is empty").max(SPEC_MAX_NODES),
  edges: z.array(specEdgeSchema).max(SPEC_MAX_EDGES),
});

// projectId and designContext are set by the route from the project the user can access, never
// taken from the client.
export const generateSpecPayloadSchema = specRequestSchema.extend({
  projectId: z.string().min(1),
  designContext: designContextSchema,
  // The project's GitHub repository (spec 63); optional so runs started before it existed still parse.
  repositoryUrl: z.string().max(300).nullable().optional(),
});

export type GenerateSpecPayload = z.infer<typeof generateSpecPayloadSchema>;

// Architecture review (spec 52): same canvas input as spec generation, without the chat.
export const reviewRequestSchema = z.object({
  roomId: z.string().min(1),
  nodes: z.array(specNodeSchema).min(1, "The canvas is empty").max(SPEC_MAX_NODES),
  edges: z.array(specEdgeSchema).max(SPEC_MAX_EDGES),
});

// As with specs, projectId and designContext come from the project the route resolved.
export const reviewPayloadSchema = reviewRequestSchema.omit({ roomId: true }).extend({
  projectId: z.string().min(1),
  designContext: designContextSchema,
});

export type ReviewPayload = z.infer<typeof reviewPayloadSchema>;

export const REVIEW_PILLARS = ["reliability", "security", "cost", "performance", "operations"] as const;
export type ReviewPillar = (typeof REVIEW_PILLARS)[number];
export const REVIEW_SEVERITIES = ["high", "medium", "low"] as const;
export const REVIEW_MAX_FINDINGS = 20;

// The model's answer, written for OpenAI's strict structured output (as in lib/design-actions.ts):
// every field required, no length rules on strings. Number and array bounds are allowed there.
export const reviewResultSchema = z.object({
  summary: z.string().describe("Two or three sentences on the design's overall strengths and biggest risks"),
  pillars: z
    .array(
      z.object({
        pillar: z.enum(REVIEW_PILLARS),
        score: z.number().int().min(1).max(5).describe("1 = major gaps, 5 = follows best practice"),
        notes: z.string().describe("Why this score, in one or two sentences"),
      })
    )
    .length(REVIEW_PILLARS.length)
    .describe("Exactly one entry per pillar")
    // JSON schema can't say "each pillar once", so it's checked when the answer is parsed.
    .refine((pillars) => new Set(pillars.map((entry) => entry.pillar)).size === REVIEW_PILLARS.length, {
      message: "Each pillar must appear exactly once",
    }),
  findings: z
    .array(
      z.object({
        severity: z.enum(REVIEW_SEVERITIES),
        pillar: z.enum(REVIEW_PILLARS),
        title: z.string(),
        detail: z.string().describe("What the problem is and why it matters for this design"),
        recommendation: z.string().describe("A concrete change to the design"),
        nodeIds: z.array(z.string()).describe("IDs of the canvas nodes involved; empty when it's about the design as a whole"),
      })
    )
    .max(REVIEW_MAX_FINDINGS),
});

export type ReviewResult = z.infer<typeof reviewResultSchema>;

// Rough monthly cost estimate (spec 64). The traffic tiers' sizes are spelled out in the task's prompt.
export const COST_TRAFFIC_TIERS = ["small", "medium", "large"] as const;

export const costAssumptionsSchema = z.object({
  trafficTier: z.enum(COST_TRAFFIC_TIERS),
  // The provider's region name, e.g. "westeurope" or "us-east-1"; it goes into the prompt as given.
  region: z.string().trim().min(1).max(40),
});

export type CostAssumptions = z.infer<typeof costAssumptionsSchema>;

// Same canvas input as the review, plus the sizing assumptions.
export const costRequestSchema = reviewRequestSchema.extend({ assumptions: costAssumptionsSchema });

// projectId and designContext come from the project the route resolved, as for the review.
export const costPayloadSchema = reviewPayloadSchema.extend({ assumptions: costAssumptionsSchema });

export type CostPayload = z.infer<typeof costPayloadSchema>;

// The model's answer, for OpenAI's strict structured output like reviewResultSchema: no optional fields.
export const costEstimateSchema = z.object({
  currency: z.enum(["USD"]),
  lineItems: z.array(
    z.object({
      nodeId: z.string().describe("ID of the canvas node (in square brackets in the node list)"),
      service: z.string().describe("The billable service, e.g. Azure SQL Database"),
      tier: z.string().describe("The SKU or tier priced, e.g. General Purpose, 2 vCores"),
      monthlyLow: z.number().min(0),
      monthlyHigh: z.number().min(0),
      assumption: z.string().describe("The sizing behind the range: instance size, count, storage, requests, data transfer"),
    })
  ),
  unpricedNodeIds: z.array(z.string()).describe("IDs of components that aren't billable cloud services, such as clients"),
  totalLow: z.number(),
  totalHigh: z.number(),
  caveats: z.array(z.string()),
});

export type CostEstimate = z.infer<typeof costEstimateSchema>;

// Infrastructure-as-code generation (spec 66): the review's canvas input plus the format.
export const iacRequestSchema = reviewRequestSchema.extend({ format: z.enum(IAC_FORMATS) });

// projectId and designContext come from the project the route resolved, as for the review.
export const iacPayloadSchema = reviewPayloadSchema.extend({ format: z.enum(IAC_FORMATS) });

export type IacPayload = z.infer<typeof iacPayloadSchema>;

// The model's answer, for OpenAI's strict structured output like the others: no optional fields.
// Paths, sizes and file types are checked afterwards (iacFilesError in lib/iac-bundle.ts).
export const iacOutputSchema = z.object({
  files: z.array(
    z.object({
      path: z.string().describe('Relative path using "/", e.g. modules/payment_db/main.tf'),
      content: z.string(),
    })
  ),
  notes: z
    .array(z.string())
    .describe('The decision checklist first, one "Decide: ..." entry per configuration value chosen, then other notes'),
});

export type IacOutput = z.infer<typeof iacOutputSchema>;

// What a finished run hands the browser (spec 67 lists and downloads the bundle).
export type IacRunOutput = { bundleId: string; notes: string[] };
