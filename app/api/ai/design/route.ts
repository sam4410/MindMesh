import { runs, tasks } from "@trigger.dev/sdk";

import { getAccessibleProject, getCurrentIdentity } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import type { designAgent } from "@/trigger/design-agent";

const MAX_PROMPT_LENGTH = 4000;

interface DesignBody {
  prompt?: unknown;
  roomId?: unknown;
  projectId?: unknown;
}

// Starts a design run for a project and records who started it.
export async function POST(req: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: DesignBody | null = await req.json().catch(() => null);
  const { prompt, roomId, projectId } = body ?? {};

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
    ({ id: runId } = await tasks.trigger<typeof designAgent>("design-agent", {
      prompt: trimmedPrompt,
      roomId,
    }));
  } catch (err) {
    console.error("Failed to start design task", err);
    return Response.json({ error: "Couldn't start the task" }, { status: 502 });
  }

  try {
    await prisma.taskRun.create({ data: { runId, projectId, userId: identity.userId } });
  } catch (err) {
    console.error("Failed to record design task run", err);
    // Without a record nobody can get a token for this run, so don't leave it running untracked.
    await runs.cancel(runId).catch((cancelErr) => {
      console.error("Failed to cancel untracked design task run", cancelErr);
    });
    return Response.json({ error: "Couldn't start the task" }, { status: 502 });
  }

  return Response.json({ runId }, { status: 202 });
}
