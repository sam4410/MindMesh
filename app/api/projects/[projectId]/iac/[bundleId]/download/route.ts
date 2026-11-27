import { get } from "@vercel/blob";

import { iacFilename } from "@/lib/iac-bundle";
import { getAccessibleProject, getCurrentIdentity, projectAccessError } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]/iac/[bundleId]/download">;

// Streams an infrastructure-as-code bundle as a zip attachment (spec 67), like the spec download
// route. The Blob URL never reaches the browser.
export async function GET(_req: Request, ctx: Context) {
  const { projectId, bundleId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return projectAccessError(projectId);

  // Looked up within the project, so another project's bundle ID can't be used here.
  const bundle = await prisma.iacBundle.findFirst({
    where: { id: bundleId, projectId },
    select: { filePath: true, format: true, createdAt: true },
  });
  if (!bundle) return Response.json({ error: "Bundle not found" }, { status: 404 });

  try {
    const blob = await get(bundle.filePath, { access: "private" });
    if (blob?.statusCode !== 200) return Response.json({ error: "Bundle file not found" }, { status: 404 });

    return new Response(blob.stream, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${iacFilename(project.name, bundle.format, bundle.createdAt)}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Failed to read IaC bundle from Vercel Blob", err);
    return Response.json({ error: "Couldn't download the bundle" }, { status: 502 });
  }
}
