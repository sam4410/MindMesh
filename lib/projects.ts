import { prisma } from "@/lib/prisma";

export interface ProjectSummary {
  id: string;
  name: string;
}

const summary = { id: true, name: true } as const;

// Projects the user owns, plus projects shared with their email as a collaborator.
export async function getProjectsForUser(userId: string, email: string | undefined) {
  const [owned, shared] = await Promise.all([
    prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      select: summary,
    }),
    email
      ? prisma.project.findMany({
          where: {
            ownerId: { not: userId },
            // Collaborator emails must be stored lowercased for this match.
            collaborators: { some: { email: email.trim().toLowerCase() } },
          },
          orderBy: { createdAt: "desc" },
          select: summary,
        })
      : [],
  ]);
  return { owned, shared };
}
