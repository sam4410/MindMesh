import { iacFilename } from "@/lib/iac-bundle";
import { getAccessibleProject, getCurrentIdentity, projectAccessError } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]/iac">;

// shortcut: newest 50 only, like the spec list; add paging if projects keep more bundles.
const MAX_BUNDLES = 50;

// Lists a project's infrastructure-as-code bundles (spec 67), newest first: metadata only, the zip
// comes from the download route.
export async function GET(_req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return projectAccessError(projectId);

  const bundles = await prisma.iacBundle.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: MAX_BUNDLES,
    select: { id: true, format: true, fileCount: true, createdAt: true },
  });
  return Response.json(
    {
      bundles: bundles.map((bundle) => ({
        id: bundle.id,
        format: bundle.format,
        fileCount: bundle.fileCount,
        filename: iacFilename(project.name, bundle.format, bundle.createdAt),
        createdAt: bundle.createdAt.toISOString(),
      })),
    },
    { headers: { "cache-control": "private, no-store" } }
  );
}
