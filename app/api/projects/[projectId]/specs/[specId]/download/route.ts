import { get } from "@vercel/blob";

import { getAccessibleProject, getCurrentIdentity, projectAccessError } from "@/lib/project-access";
import { specFilename } from "@/lib/project-spec";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]/specs/[specId]/download">;

// Streams a generated spec as a Markdown attachment. The Blob URL never reaches the browser.
export async function GET(_req: Request, ctx: Context) {
  const { projectId, specId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return projectAccessError(projectId);

  // Looked up within the project, so another project's spec ID can't be used here.
  const spec = await prisma.projectSpec.findFirst({
    where: { id: specId, projectId },
    select: { id: true, filePath: true, createdAt: true },
  });
  if (!spec) return Response.json({ error: "Spec not found" }, { status: 404 });

  try {
    const blob = await get(spec.filePath, { access: "private" });
    if (blob?.statusCode !== 200) return Response.json({ error: "Spec file not found" }, { status: 404 });

    return new Response(blob.stream, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${specFilename(project.name, spec.createdAt, spec.id)}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Failed to read spec from Vercel Blob", err);
    return Response.json({ error: "Couldn't download the spec" }, { status: 502 });
  }
}
