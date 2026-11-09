import { getAccessibleProject, getCurrentIdentity, projectAccessError } from "@/lib/project-access";
import { specFilename } from "@/lib/project-spec";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]/specs">;

// shortcut: newest 50 only, enough for the sidebar list; add paging if projects keep more specs.
const MAX_SPECS = 50;

// Lists a project's specs, newest first: metadata only, the content comes from the download route.
export async function GET(_req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return projectAccessError(projectId);

  const specs = await prisma.projectSpec.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: MAX_SPECS,
    select: { id: true, createdAt: true },
  });
  return Response.json(
    {
      specs: specs.map((spec) => ({
        id: spec.id,
        filename: specFilename(project.name, spec.createdAt),
        createdAt: spec.createdAt.toISOString(),
      })),
    },
    { headers: { "cache-control": "private, no-store" } }
  );
}
