import { prisma } from "@/lib/prisma";

export interface ProjectSummary {
  id: string;
  name: string;
}

const summary = { id: true, name: true } as const;

// Projects the user owns, plus projects shared with their email as a collaborator.
// The email must already be lowercased (getCurrentIdentity does this).
export async function getProjectsForUser(userId: string, email: string | undefined) {
  const [owned, shared] = await Promise.all([
    prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      select: summary,
    }),
    email
      ? prisma.project.findMany({
          where: { ownerId: { not: userId }, collaborators: { some: { email } } },
          orderBy: { createdAt: "desc" },
          select: summary,
        })
      : [],
  ]);
  return { owned, shared };
}
