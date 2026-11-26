import { LiveblocksError } from "@liveblocks/node";
import { del, list } from "@vercel/blob";

import { canvasBlobPath } from "@/lib/canvas-snapshot";
import { getLiveblocks } from "@/lib/liveblocks";
import { getAccessibleProject, getCurrentIdentity, requireProjectManager } from "@/lib/project-access";
import { specBlobFolder } from "@/lib/project-spec";
import { versionBlobFolder } from "@/lib/project-version";
import { readProjectInput } from "@/lib/project-input";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]">;

// Deletes every Blob under a folder, a page at a time. The records cascade away with the project,
// the files don't.
async function deleteBlobFolder(prefix: string) {
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor });
    if (page.blobs.length > 0) await del(page.blobs.map((blob) => blob.url));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}

// Renames and/or sets the repository link (owner or admin only), and/or updates the design context
// (anyone with access: it describes the design, not project management).
export async function PATCH(req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const input = await readProjectInput(req);
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });
  const changesRepository = input.repositoryUrl !== undefined;
  if (!input.name && !input.designContext && !changesRepository) {
    return Response.json({ error: "name, designContext or repositoryUrl is required" }, { status: 400 });
  }

  if (input.name || changesRepository) {
    const denied = await requireProjectManager(projectId);
    if (denied) return denied;
  } else if (!(await getAccessibleProject(projectId, identity))) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      name: input.name,
      ...input.designContext,
      ...(changesRepository && { repositoryUrl: input.repositoryUrl }),
    },
  });
  return Response.json(project);
}

export async function DELETE(_req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const denied = await requireProjectManager(projectId, { allowDeletionPending: true });
  if (denied) return denied;

  const { count } = await prisma.project.updateMany({
    where: { id: projectId },
    data: { deletionPending: true },
  });
  if (count === 0) return new Response(null, { status: 204 });

  try {
    await getLiveblocks().deleteRoom(projectId);
  } catch (err) {
    // A project that was never opened has no room.
    if (!(err instanceof LiveblocksError && err.status === 404)) {
      console.error("Failed to delete Liveblocks room", err);
      return Response.json(
        { error: "Couldn't delete the project's canvas. Please try again." },
        { status: 502 }
      );
    }
  }

  try {
    // By path, not the saved URL: an upload racing this delete may not have stored its URL yet.
    await del(canvasBlobPath(projectId));
  } catch (err) {
    console.error("Failed to delete canvas blob", err);
    return Response.json(
      { error: "Couldn't delete the project's canvas. Please try again." },
      { status: 502 }
    );
  }

  try {
    // By folder, like the canvas by path.
    await deleteBlobFolder(specBlobFolder(projectId));
  } catch (err) {
    console.error("Failed to delete spec blobs", err);
    return Response.json(
      { error: "Couldn't delete the project's specs. Please try again." },
      { status: 502 }
    );
  }

  try {
    await deleteBlobFolder(versionBlobFolder(projectId));
  } catch (err) {
    console.error("Failed to delete version blobs", err);
    return Response.json(
      { error: "Couldn't delete the project's versions. Please try again." },
      { status: 502 }
    );
  }

  try {
    await prisma.project.deleteMany({
      where: { id: projectId, deletionPending: true },
    });
  } catch (err) {
    console.error("Failed to delete project after deleting its Liveblocks room", err);
    return Response.json(
      { error: "Couldn't finish deleting the project. Please try again." },
      { status: 500 }
    );
  }
  return new Response(null, { status: 204 });
}
