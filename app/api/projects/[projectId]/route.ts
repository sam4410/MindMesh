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
  const denied = await requireOwner(projectId);
  if (denied) return denied;

  await prisma.project.delete({ where: { id: projectId } });
  return new Response(null, { status: 204 });
}
