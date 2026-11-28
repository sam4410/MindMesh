import { z } from "zod";

import { adrRequested } from "@/inngest/client";
import { getDesignContext } from "@/lib/design-context";
import { getAccessibleProject, getCurrentIdentity } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { startTaskRun } from "@/lib/task-runs";
import { specRequestSchema } from "@/types/tasks";

const ADR_MAX_DECISIONS = 30;

// Starts ADR generation (spec 58) for the project behind roomId and records who started it. Same
// request as POST /api/ai/spec.
// shortcut: no usage check yet; billing (specs 34 and 36) is deferred.
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
    // The AI architect's newest decisions (spec 72), so the records keep its actual reasons.
    const recordedDecisions = await prisma.designDecision.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: ADR_MAX_DECISIONS,
      select: { title: true, choice: true, reasons: true, alternatives: true, tradeoffs: true, nodeIds: true },
    });
    runId = await startTaskRun(adrRequested, {
      projectId: project.id,
      userId: identity.userId,
      input: {
        projectId: project.id,
        roomId,
        chatHistory,
        nodes,
        edges,
        designContext: getDesignContext(project),
        repositoryUrl: project.repositoryUrl,
        recordedDecisions,
      },
    });
  } catch (err) {
    console.error("Failed to start ADR run", err);
    return Response.json({ error: "Couldn't start the task" }, { status: 502 });
  }

  return Response.json({ runId }, { status: 202 });
}
