import { z } from "zod";

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

// Spec generation input comes from the browser, so the route and the task both validate it.
// Only what a spec needs is kept; other node and edge fields (position, size, color) are stripped.
// shortcut: these caps fit a single-page diagram and conversation; raise them if real projects hit them.
const SPEC_MAX_NODES = 500;
const SPEC_MAX_EDGES = 1000;
export const SPEC_MAX_CHAT_MESSAGES = 200;
const SPEC_MAX_LABEL_LENGTH = 500;

const specNodeSchema = z.object({
  id: z.string().min(1),
  data: z.object({ label: z.string().max(SPEC_MAX_LABEL_LENGTH), shape: z.enum(NODE_SHAPES) }),
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

// projectId is set by the route from the project the user can access, never taken from the client.
export const generateSpecPayloadSchema = specRequestSchema.extend({ projectId: z.string().min(1) });

export type GenerateSpecPayload = z.infer<typeof generateSpecPayloadSchema>;
