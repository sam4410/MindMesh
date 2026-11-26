import { z } from "zod";

import { costRequested } from "@/inngest/client";
import { COST_PROVIDER_REQUIRED, isPricedProvider } from "@/lib/cost-estimate";
import { getDesignContext } from "@/lib/design-context";
import { getAccessibleProject, getCurrentIdentity } from "@/lib/project-access";
import { startTaskRun } from "@/lib/task-runs";
import { costRequestSchema } from "@/types/tasks";

// Starts a rough monthly cost estimate (spec 64) for the project behind roomId and records who
// started it. Mirrors POST /api/ai/review; the browser polls GET /api/ai/runs/[runId] for the result.
// shortcut: no usage check or TaskRun kind until billing (specs 34–39) returns.
export async function POST(req: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await req.json().catch(() => null);
  const parsed = costRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const { roomId, nodes, edges, assumptions } = parsed.data;

  // The room ID is the project ID; any projectId in the body is ignored.
  const project = await getAccessibleProject(roomId, identity);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  // Checked before starting a run, so a project without AWS, Azure or GCP never reaches the model.
  if (!isPricedProvider(project.cloudProvider)) {
    return Response.json({ error: COST_PROVIDER_REQUIRED }, { status: 400 });
  }

  let runId: string;
  try {
    runId = await startTaskRun(costRequested, {
      projectId: project.id,
      userId: identity.userId,
      input: {
        projectId: project.id,
        nodes,
        edges,
        designContext: getDesignContext(project),
        assumptions,
      },
    });
  } catch (err) {
    console.error("Failed to start cost estimate run", err);
    return Response.json({ error: "Couldn't start the task" }, { status: 502 });
  }

  return Response.json({ runId }, { status: 202 });
}
