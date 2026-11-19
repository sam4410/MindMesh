import { del, get } from "@vercel/blob";

import { getAccessibleProject, getCurrentIdentity, projectAccessError, requireProjectManager } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]/versions/[versionId]">;

// Returns a version's canvas snapshot ({ nodes, edges }). The Blob URL never reaches the browser.
export async function GET(_req: Request, ctx: Context) {
  const { projectId, versionId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return projectAccessError(projectId);

  // Looked up within the project, so another project's version ID can't be used here.
  const version = await prisma.projectVersion.findFirst({
    where: { id: versionId, projectId },
    select: { filePath: true },
  });
  if (!version) return Response.json({ error: "Version not found" }, { status: 404 });

  try {
    const blob = await get(version.filePath, { access: "private" });
    if (blob?.statusCode !== 200) return Response.json({ error: "Version file not found" }, { status: 404 });
    return new Response(blob.stream, {
      headers: { "content-type": "application/json", "cache-control": "private, no-store" },
    });
  } catch (err) {
    console.error("Failed to read version from Vercel Blob", err);
    return Response.json({ error: "Couldn't load the version" }, { status: 502 });
  }
}

// Owner or admin only: deletes the file, then the record.
export async function DELETE(_req: Request, ctx: Context) {
  const { projectId, versionId } = await ctx.params;
  const denied = await requireProjectManager(projectId);
  if (denied) return denied;

  const version = await prisma.projectVersion.findFirst({
    where: { id: versionId, projectId },
    select: { id: true, filePath: true },
  });
  if (!version) return Response.json({ error: "Version not found" }, { status: 404 });

  try {
    await del(version.filePath);
  } catch (err) {
    console.error("Failed to delete version blob", err);
    return Response.json({ error: "Couldn't delete the version. Please try again." }, { status: 502 });
  }
  // deleteMany: a delete racing this one may already have removed the row.
  await prisma.projectVersion.deleteMany({ where: { id: version.id, projectId } });
  return new Response(null, { status: 204 });
}
