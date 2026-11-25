import { z } from "zod";

import { reviewRequested } from "@/inngest/client";
import { getDesignContext } from "@/lib/design-context";
import { getAccessibleProject, getCurrentIdentity } from "@/lib/project-access";
import { startTaskRun } from "@/lib/task-runs";
import { reviewRequestSchema } from "@/types/tasks";

// Starts an architecture review (spec 52) for the project behind roomId and records who started it.
// Mirrors POST /api/ai/spec. shortcut: no usage check or TaskRun kind until billing (specs 34–39) returns.
export async function POST(req: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await req.json().catch(() => null);
  const parsed = reviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const { roomId, nodes, edges } = parsed.data;

  // The room ID is the project ID; any projectId in the body is ignored.
  const project = await getAccessibleProject(roomId, identity);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  let runId: string;
  try {
    runId = await startTaskRun(reviewRequested, {
      projectId: project.id,
      userId: identity.userId,
      input: {
        projectId: project.id,
        nodes,
        edges,
        designContext: getDesignContext(project),
      },
    });
  } catch (err) {
    console.error("Failed to start review run", err);
    return Response.json({ error: "Couldn't start the task" }, { status: 502 });
  }

  return Response.json({ runId }, { status: 202 });
}
