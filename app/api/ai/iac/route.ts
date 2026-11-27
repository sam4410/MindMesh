import { z } from "zod";

import { iacRequested } from "@/inngest/client";
import { getDesignContext } from "@/lib/design-context";
import { iacFormatError } from "@/lib/iac-bundle";
import { getAccessibleProject, getCurrentIdentity } from "@/lib/project-access";
import { startTaskRun } from "@/lib/task-runs";
import { iacRequestSchema } from "@/types/tasks";

// Starts infrastructure-as-code generation (spec 66) for the project behind roomId and records who
// started it. Mirrors POST /api/ai/review; the browser polls GET /api/ai/runs/[runId] for the result.
// shortcut: no usage check, TaskRun kind or Team-only limit until billing (specs 34–39) returns.
export async function POST(req: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await req.json().catch(() => null);
  const parsed = iacRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const { roomId, nodes, edges, format } = parsed.data;

  // The room ID is the project ID; any projectId in the body is ignored.
  const project = await getAccessibleProject(roomId, identity);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  // Checked before starting a run: AWS and GCP get Terraform, Azure Terraform or Bicep, others nothing.
  const formatError = iacFormatError(project.cloudProvider, format);
  if (formatError) return Response.json({ error: formatError }, { status: 400 });

  let runId: string;
  try {
    runId = await startTaskRun(iacRequested, {
      projectId: project.id,
      userId: identity.userId,
      input: {
        projectId: project.id,
        nodes,
        edges,
        designContext: getDesignContext(project),
        format,
      },
    });
  } catch (err) {
    console.error("Failed to start IaC run", err);
    return Response.json({ error: "Couldn't start the task" }, { status: 502 });
  }

  return Response.json({ runId }, { status: 202 });
}
