import { LiveblocksError } from "@liveblocks/node";
import { del, list } from "@vercel/blob";

import { canvasBlobPath } from "@/lib/canvas-snapshot";
import { getLiveblocks } from "@/lib/liveblocks";
import { getAccessibleProject, getCurrentIdentity, requireProjectManager } from "@/lib/project-access";
import { specBlobFolder } from "@/lib/project-spec";
import { readProjectInput } from "@/lib/project-input";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]">;

// Renames (owner or admin only) and/or updates the design context (anyone with access: it
// describes the design, not project management).
export async function PATCH(req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const input = await readProjectInput(req);
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });
  if (!input.name && !input.designContext) {
    return Response.json({ error: "name or designContext is required" }, { status: 400 });
  }

  if (input.name) {
    const denied = await requireProjectManager(projectId);
    if (denied) return denied;
  } else if (!(await getAccessibleProject(projectId, identity))) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: { name: input.name, ...input.designContext },
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
    // By folder, like the canvas by path: the records cascade away with the project, the files don't.
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: specBlobFolder(projectId), cursor });
      if (page.blobs.length > 0) await del(page.blobs.map((blob) => blob.url));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } catch (err) {
    console.error("Failed to delete spec blobs", err);
    return Response.json(
      { error: "Couldn't delete the project's specs. Please try again." },
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
