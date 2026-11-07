import { requireOwner } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]/collaborators/[collaboratorId]">;

export async function DELETE(_req: Request, ctx: Context) {
  const { projectId, collaboratorId } = await ctx.params;
  const denied = await requireOwner(projectId);
  if (denied) return denied;

  // Scoped to the project so an owner can't remove another project's collaborator by ID.
  const { count } = await prisma.projectCollaborator.deleteMany({
    where: { id: collaboratorId, projectId },
  });
  if (count === 0) return Response.json({ error: "Collaborator not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
