import { checkApprovalChange, isApprovalStatus } from "@/lib/project-approval";
import { getAccessibleProject, getCurrentIdentity, getProjectRole, projectAccessError } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]/approval">;

const APPROVAL_FIELDS = { approvalStatus: true, approvedById: true, approvedByName: true, approvedAt: true } as const;

// Moves a project along Draft → In review → Approved (spec 57). Body: { status }.
export async function PATCH(req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return projectAccessError(projectId);

  const body: unknown = await req.json().catch(() => null);
  const status = (body as { status?: unknown } | null)?.status;
  if (!isApprovalStatus(status)) {
    return Response.json({ error: "status must be DRAFT, IN_REVIEW or APPROVED" }, { status: 400 });
  }

  const current = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { approvalStatus: true } });
  const check = checkApprovalChange(current.approvalStatus, status, getProjectRole(project, identity));
  if (check === "invalid") {
    return Response.json({ error: `Can't change approval from ${current.approvalStatus} to ${status}` }, { status: 409 });
  }
  if (check === "forbidden") {
    return Response.json({ error: "Only the owner or an admin can do this" }, { status: 403 });
  }

  const approval =
    status === "APPROVED"
      ? { approvedById: identity.userId, approvedByName: identity.name, approvedAt: new Date() }
      : { approvedById: null, approvedByName: null, approvedAt: null };
  // Conditional on the status read above, so a change made meanwhile by someone else isn't overwritten.
  const { count } = await prisma.project.updateMany({
    where: { id: projectId, approvalStatus: current.approvalStatus },
    data: { approvalStatus: status, ...approval },
  });
  if (count === 0) {
    return Response.json({ error: "The approval status just changed. Reload and try again." }, { status: 409 });
  }

  const updated = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: APPROVAL_FIELDS });
  return Response.json({ ...updated, approvedAt: updated.approvedAt?.toISOString() ?? null });
}
