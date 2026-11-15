import { getDesignContext, type DesignContext } from "@/lib/design-context";
import { getProjectRole, type Identity } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import type { ProjectRole } from "@/lib/project-roles";

export interface ProjectSummary {
  id: string;
  name: string;
  deletionPending: boolean;
  role: ProjectRole;
  designContext: DesignContext;
}

const select = {
  id: true,
  name: true,
  deletionPending: true,
  ownerId: true,
  organizationId: true,
  cloudProvider: true,
  architectureStyle: true,
  industry: true,
  projectType: true,
} as const;

// "My Projects" for the active workspace (every project in the active organization, or the user's
// personal projects), plus projects shared with the user's email as a collaborator.
// The email must already be lowercased (getCurrentIdentity does this).
export async function getProjectsForUser(identity: Identity) {
  const { userId, email, orgId } = identity;
  const [owned, shared] = await Promise.all([
    prisma.project.findMany({
      where: orgId
        ? { organizationId: orgId }
        : { ownerId: userId, organizationId: null },
      orderBy: { createdAt: "desc" },
      select,
    }),
    email
      ? prisma.project.findMany({
          where: {
            ownerId: { not: userId },
            deletionPending: false,
            collaborators: { some: { email } },
          },
          orderBy: { createdAt: "desc" },
          select,
        })
      : [],
  ]);
  const toSummary = (project: (typeof owned)[number]): ProjectSummary => ({
    id: project.id,
    name: project.name,
    deletionPending: project.deletionPending,
    role: getProjectRole(project, identity),
    designContext: getDesignContext(project),
  });
  return { owned: owned.map(toSummary), shared: shared.map(toSummary) };
}
