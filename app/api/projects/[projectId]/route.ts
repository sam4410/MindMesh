import { auth } from "@clerk/nextjs/server";

import { readProjectInput } from "@/lib/project-input";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]">;

// Returns an error response unless the signed-in user owns the project.
async function checkOwner(projectId: string) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (project.ownerId !== userId) {
    return Response.json({ error: "Only the project owner can do this" }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const denied = await checkOwner(projectId);
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
  const denied = await checkOwner(projectId);
  if (denied) return denied;

  await prisma.project.delete({ where: { id: projectId } });
  return new Response(null, { status: 204 });
}
