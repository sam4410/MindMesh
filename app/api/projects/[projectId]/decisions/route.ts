import { getAccessibleProject, getCurrentIdentity, projectAccessError } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]/decisions">;

// shortcut: newest 100 only; add paging if projects record more decisions.
const MAX_DECISIONS = 100;

// Lists the design decisions the AI architect recorded for a project (spec 72), newest first.
export async function GET(_req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return projectAccessError(projectId);

  const decisions = await prisma.designDecision.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: MAX_DECISIONS,
    select: {
      id: true,
      title: true,
      choice: true,
      reasons: true,
      alternatives: true,
      tradeoffs: true,
      nodeIds: true,
      sources: true,
      createdAt: true,
    },
  });
  return Response.json(
    { decisions: decisions.map((decision) => ({ ...decision, createdAt: decision.createdAt.toISOString() })) },
    { headers: { "cache-control": "private, no-store" } }
  );
}
