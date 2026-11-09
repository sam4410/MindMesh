import { runs, tasks } from "@trigger.dev/sdk";
import { z } from "zod";

import { getAccessibleProject, getCurrentIdentity } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import type { generateSpec } from "@/trigger/generate-spec";
import { specRequestSchema } from "@/types/tasks";

// Starts spec generation for the project behind roomId and records who started it.
export async function POST(req: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await req.json().catch(() => null);
  const parsed = specRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const { roomId, chatHistory, nodes, edges } = parsed.data;

  // The room ID is the project ID; any projectId in the body is ignored.
  const project = await getAccessibleProject(roomId, identity);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  let runId: string;
  try {
    ({ id: runId } = await tasks.trigger<typeof generateSpec>("generate-spec", {
      projectId: project.id,
      roomId,
      chatHistory,
      nodes,
      edges,
    }));
  } catch (err) {
    console.error("Failed to start spec task", err);
    return Response.json({ error: "Couldn't start the task" }, { status: 502 });
  }

  try {
    await prisma.taskRun.create({ data: { runId, projectId: project.id, userId: identity.userId } });
  } catch (err) {
    console.error("Failed to record spec task run", err);
    // Without a record nobody can get a token for this run, so don't leave it running untracked.
    await runs.cancel(runId).catch((cancelErr) => {
      console.error("Failed to cancel untracked spec task run", cancelErr);
    });
    return Response.json({ error: "Couldn't start the task" }, { status: 502 });
  }

  return Response.json({ runId }, { status: 202 });
}
