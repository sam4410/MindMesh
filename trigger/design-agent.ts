import { openai } from "@ai-sdk/openai";
import { LiveblocksError } from "@liveblocks/node";
import { mutateFlow } from "@liveblocks/react-flow/node";
import { logger, task } from "@trigger.dev/sdk";
import { generateText, Output } from "ai";

import { AI_AGENT } from "@/lib/ai-status";
import {
  GRID,
  MAX_NODE_SIZE,
  applyDesignAction,
  cellOf,
  designPlanSchema,
  type DesignPlan,
} from "@/lib/design-actions";
import { getLiveblocks } from "@/lib/liveblocks";
import { NODE_COLORS, type CanvasEdge, type CanvasNode } from "@/types/canvas";
import { AI_STATUS_FEED_ID, type TaskStatusMessage } from "@/types/tasks";

interface DesignAgentPayload {
  prompt: string;
  roomId: string;
}

const MODEL_ID = "gpt-6-luna";
// Fails the run with a status message instead of leaving everyone watching "thinking" for minutes.
const PLAN_TIMEOUT_MS = 120_000;
// shortcut: caps how much one prompt can change, raise it if large designs get cut off.
const MAX_ACTIONS = 80;
// Presence expires on its own if the worker dies; the heartbeat keeps it alive meanwhile.
const PRESENCE_TTL_SECONDS = 60;
const HEARTBEAT_MS = 20_000;

const SYSTEM_PROMPT = `You are Ghost AI, a senior system design architect working on a shared canvas.
Turn the user's request into canvas actions. Extend or edit the existing canvas when it has content; never recreate nodes that already exist. When editing, change only what the request asks for.

Fill in "plan" before anything else: list the components, then every flow between them (who calls or sends what to whom), and check it against the architecture rules. Then write the actions from that plan.

Architecture rules for new designs and additions:
- Include every component the user names, plus what a production system of that kind needs for those parts to work. Split responsibilities the request bundles together when they'd be separate services in production (for example authentication apart from user profiles).
- Clients go through the entry point (API gateway or load balancer), which routes each kind of request straight to the service that owns it. Never route one service's traffic through an unrelated service.
- Every service that stores data (users, products, orders and the like) has its own database node, and clients never reach a data store directly.
- A cache sits beside the service it speeds up: draw the service reading the cache and the service reading its database on a miss. Never put a database behind a cache.
- A queue or stream has both sides drawn: producer to queue and queue to consumer.
- Draw the service-to-service calls the flows need, such as verifying a token or updating stock.
- Stay focused: about 6 to 15 nodes unless the user asks for more. Don't add monitoring, CI or similar unless asked.

Edges: every edge points in the direction of the call or data flow and has a short label naming the interaction ("Authenticate", "Read Cache", "Cache Miss", "Publish Order"). One edge per interaction: don't add a reverse edge for the response.

Shapes:
- rectangle: services, gateways, load balancers and other components (the default)
- cylinder: databases, caches and storage
- pill: queues, streams and topics
- circle: users and clients
- hexagon: third-party or external systems
- diamond: only a real decision or branch in a flow, never a component

Colors by role, the same color for every node of a role: Blue for services and gateways, Purple for auth and security, Green for databases, caches and storage, Orange for queues and streams, Pink for users and clients, Teal for external systems, Neutral for anything else.

Layout rules:
- The canvas is a grid of cells ${GRID.column}px wide and ${GRID.row}px tall, addressed by integer column and row, starting at 0. Place at most one node per cell.
- Flow runs left to right: clients in column 0, then the entry point, services, and data stores and external systems in higher columns. Spread parallel components over rows of the same column.
- Put each data store and cache in the column right after the service that uses it, on the same or a neighbouring row. A service's cache and database go in that same column on different rows, never one behind the other, so no edge has to pass through a node.

Labels: short, 1 to 3 words, naming the role ("Order Service", "Product DB").
Sizes for resizeNode: width and height in pixels, at most ${MAX_NODE_SIZE.width}x${MAX_NODE_SIZE.height}.

New nodes get a temporary id you choose (like "n1"); use it to connect edges in the same response. Refer to existing nodes and edges by their id.
Use at most ${MAX_ACTIONS} actions. If the request isn't about system design, return no actions and say so in the summary.`;

export const designAgent = task({
  id: "design-agent",
  // A retry would apply the canvas changes from the failed attempt a second time.
  retry: { maxAttempts: 1 },
  run: async ({ prompt, roomId }: DesignAgentPayload) => {
    const liveblocks = getLiveblocks();
    // Same call as /api/liveblocks-auth, so the room exists even if nobody has opened it yet.
    await liveblocks.getOrCreateRoom(roomId, { defaultAccesses: [] });
    await ensureStatusFeed(roomId);

    // Status and presence are best effort: a failed update must not abort the design.
    const postStatus = async (status: TaskStatusMessage["status"], text: string) => {
      try {
        await liveblocks.createFeedMessage({ roomId, feedId: AI_STATUS_FEED_ID, data: { status, text } satisfies TaskStatusMessage });
      } catch (err) {
        logger.warn("Couldn't post AI status", { status, error: String(err) });
      }
    };
    let presence: Liveblocks["Presence"] = { cursor: null, thinking: true };
    const sendPresence = async (ttl = PRESENCE_TTL_SECONDS) => {
      try {
        await liveblocks.setPresence(roomId, { userId: AI_AGENT.id, userInfo: AI_AGENT.info, data: presence, ttl });
      } catch (err) {
        logger.warn("Couldn't update AI presence", { error: String(err) });
      }
    };
    const heartbeat = setInterval(() => void sendPresence(), HEARTBEAT_MS);

    try {
      await sendPresence();
      // The sidebar shows only the latest status, so this one names the request for everyone.
      const excerpt = prompt.length > 80 ? `${prompt.slice(0, 80)}…` : prompt;
      await postStatus("started", `Planning a design for “${excerpt}”…`);

      let canvas: { nodes: CanvasNode[]; edges: CanvasEdge[] } = { nodes: [], edges: [] };
      await mutateFlow<CanvasNode, CanvasEdge>({ client: liveblocks, roomId }, (flow) => {
        canvas = { nodes: [...flow.nodes], edges: [...flow.edges] };
      });

      const plan = await planDesign(prompt, canvas);
      const actions = plan.actions.slice(0, MAX_ACTIONS);
      logger.info("Design planned", { actions: actions.length, plan: plan.plan, summary: plan.summary });

      if (actions.length === 0) {
        await postStatus("completed", plan.summary || "No changes were needed.");
        return { applied: 0, skipped: 0 };
      }

      await postStatus("processing", `Applying ${actions.length} ${actions.length === 1 ? "change" : "changes"} to the canvas…`);
      const ids = new Map<string, string>();
      let applied = 0;
      // One mutation per action, so collaborators watch the design build up step by step.
      for (const action of actions) {
        let cursor: { x: number; y: number } | null = null;
        await mutateFlow<CanvasNode, CanvasEdge>({ client: liveblocks, roomId }, (flow) => {
          cursor = applyDesignAction(flow, action, ids);
        });
        if (!cursor) continue;
        applied += 1;
        presence = { cursor, thinking: true };
        await sendPresence();
      }

      const skipped = actions.length - applied;
      const skippedNote =
        skipped > 0 ? ` Skipped ${skipped} ${skipped === 1 ? "change" : "changes"} that referred to missing nodes or edges.` : "";
      await postStatus("completed", `${plan.summary}${skippedNote}`.trim());
      return { applied, skipped };
    } catch (err) {
      logger.error("Design generation failed", { error: err instanceof Error ? err.message : String(err) });
      await postStatus(
        "failed",
        "Couldn't finish the design. Any changes made before the error are still on the canvas. Try again."
      );
      // Rethrown so the run shows as failed in Trigger.dev.
      throw err;
    } finally {
      clearInterval(heartbeat);
      // There's no call to remove presence, so clear it and let it expire as soon as allowed.
      presence = { cursor: null, thinking: false };
      await sendPresence(2);
    }
  },
});

async function ensureStatusFeed(roomId: string) {
  try {
    await getLiveblocks().createFeed({ roomId, feedId: AI_STATUS_FEED_ID });
  } catch (err) {
    // 409: the feed already exists from an earlier run.
    if (!(err instanceof LiveblocksError && err.status === 409)) throw err;
  }
}

async function planDesign(
  prompt: string,
  canvas: { nodes: CanvasNode[]; edges: CanvasEdge[] }
): Promise<DesignPlan> {
  // openai() reads OPENAI_API_KEY.
  const current = {
    nodes: canvas.nodes.map((node) => ({
      id: node.id,
      label: node.data.label,
      shape: node.data.shape,
      color: NODE_COLORS.find((c) => c.fill === node.data.color)?.name ?? "Neutral",
      ...cellOf(node),
    })),
    edges: canvas.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.data?.label ?? "",
    })),
  };

  const { output } = await generateText({
    model: openai(MODEL_ID),
    system: SYSTEM_PROMPT,
    prompt: `Current canvas (JSON):\n${JSON.stringify(current)}\n\nRequest:\n${prompt}`,
    output: Output.object({ schema: designPlanSchema }),
    abortSignal: AbortSignal.timeout(PLAN_TIMEOUT_MS),
  });
  return output;
}
