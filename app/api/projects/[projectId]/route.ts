import { LiveblocksError } from "@liveblocks/node";

import { getLiveblocks } from "@/lib/liveblocks";
import { requireOwner } from "@/lib/project-access";
import { readProjectInput } from "@/lib/project-input";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]">;

export async function PATCH(req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const denied = await requireOwner(projectId);
  if (denied) return denied;

  const input = await readProjectInput(req);
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });
  if (!input.name) return Response.json({ error: "name is required" }, { status: 400 });

  const project = await prisma.project.update({
    where: { id: projectId },
    data: { name: input.name },
  });
  return Response.json(project);
}

export async function DELETE(_req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const denied = await requireOwner(projectId, { allowDeletionPending: true });
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
