import { designRequested } from "@/inngest/client";
import { getDesignContext } from "@/lib/design-context";
import { getAccessibleProject, getCurrentIdentity } from "@/lib/project-access";
import { startTaskRun } from "@/lib/task-runs";

const MAX_PROMPT_LENGTH = 4000;
// Selected nodes the request is about (spec 48).
const MAX_FOCUS_NODES = 20;
const MAX_NODE_ID_LENGTH = 120;

interface DesignBody {
  prompt?: unknown;
  roomId?: unknown;
  projectId?: unknown;
  research?: unknown;
  focusNodeIds?: unknown;
}

function isFocusNodeIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_FOCUS_NODES &&
    value.every((id) => typeof id === "string" && id.length > 0 && id.length <= MAX_NODE_ID_LENGTH)
  );
}

// Starts a design run for a project and records who started it.
export async function POST(req: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: DesignBody | null = await req.json().catch(() => null);
  const { prompt, roomId, projectId, research, focusNodeIds } = body ?? {};
  if (research !== undefined && typeof research !== "boolean") {
    return Response.json({ error: "research must be a boolean" }, { status: 400 });
  }
  if (focusNodeIds !== undefined && !isFocusNodeIds(focusNodeIds)) {
    return Response.json(
      {
        error: `focusNodeIds must be an array of at most ${MAX_FOCUS_NODES} node IDs, each 1–${MAX_NODE_ID_LENGTH} characters`,
      },
      { status: 400 }
    );
  }

  const trimmedPrompt = typeof prompt === "string" ? prompt.trim() : "";
  if (!trimmedPrompt) return Response.json({ error: "prompt is required" }, { status: 400 });
  if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
    return Response.json(
      { error: `prompt must be at most ${MAX_PROMPT_LENGTH} characters` },
      { status: 400 }
    );
  }
  if (typeof projectId !== "string" || !projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }
  // The room ID is the project ID, and access is checked on the project, so a different room can't be targeted.
  if (roomId !== projectId) {
    return Response.json({ error: "roomId must match projectId" }, { status: 400 });
  }

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  let runId: string;
  try {
    runId = await startTaskRun(designRequested, {
      projectId,
      userId: identity.userId,
      input: {
        prompt: trimmedPrompt,
        roomId,
        // From the project record on the server, never from the request body.
        designContext: getDesignContext(project),
        // Look up official best practices before designing (spec 70); off unless asked for.
        research: research === true,
        focusNodeIds: focusNodeIds ?? [],
      },
    });
  } catch (err) {
    console.error("Failed to start design run", err);
    return Response.json({ error: "Couldn't start the task" }, { status: 502 });
  }

  return Response.json({ runId }, { status: 202 });
}
