import type { Identity } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

export interface ProjectSummary {
  id: string;
  name: string;
  deletionPending: boolean;
}

const summary = { id: true, name: true, deletionPending: true } as const;

// "My Projects" for the active workspace (every project in the active organization, or the user's
// personal projects), plus projects shared with the user's email as a collaborator.
// The email must already be lowercased (getCurrentIdentity does this).
export async function getProjectsForUser({ userId, email, orgId }: Identity) {
  const [owned, shared] = await Promise.all([
    prisma.project.findMany({
      where: orgId ? { organizationId: orgId } : { ownerId: userId, organizationId: null },
      orderBy: { createdAt: "desc" },
      select: summary,
    }),
    email
      ? prisma.project.findMany({
          where: {
            ownerId: { not: userId },
            deletionPending: false,
            collaborators: { some: { email } },
          },
          orderBy: { createdAt: "desc" },
          select: summary,
        })
      : [],
  ]);
  return { owned, shared };
}
