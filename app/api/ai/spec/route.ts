import { z } from "zod";

import { specRequested } from "@/inngest/client";
import { getDesignContext } from "@/lib/design-context";
import { getAccessibleProject, getCurrentIdentity } from "@/lib/project-access";
import { startTaskRun } from "@/lib/task-runs";
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
    runId = await startTaskRun(specRequested, {
      projectId: project.id,
      userId: identity.userId,
      input: {
        projectId: project.id,
        roomId,
        chatHistory,
        nodes,
        edges,
        designContext: getDesignContext(project),
      },
    });
  } catch (err) {
    console.error("Failed to start spec run", err);
    return Response.json({ error: "Couldn't start the task" }, { status: 502 });
  }

  return Response.json({ runId }, { status: 202 });
}
