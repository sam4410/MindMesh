import { auth, currentUser } from "@clerk/nextjs/server";
import { cache } from "react";

import { prisma } from "@/lib/prisma";

export interface Identity {
  userId: string;
  email: string | undefined;
  name: string;
  imageUrl: string;
}

// Cached per request: the editor layout and workspace page both need it, and currentUser() calls Clerk's API.
export const getCurrentIdentity = cache(async (): Promise<Identity | null> => {
  const user = await currentUser();
  if (!user) return null;
  // Collaborator emails are matched lowercased.
  const email = user.primaryEmailAddress?.emailAddress.trim().toLowerCase();
  return {
    userId: user.id,
    email,
    name: user.fullName ?? user.username ?? email ?? "Anonymous",
    imageUrl: user.imageUrl,
  };
});

// Returns the project if the user owns it or collaborates on it; null for no access or no such project.
export async function getAccessibleProject(projectId: string, identity: Identity) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      deletionPending: false,
      OR: [
        { ownerId: identity.userId },
        ...(identity.email ? [{ collaborators: { some: { email: identity.email } } }] : []),
      ],
    },
    select: { id: true, name: true, ownerId: true, canvasJsonPath: true },
  });
}

// For API routes: returns an error response unless the signed-in user owns the project.
export async function requireOwner(
  projectId: string,
  { allowDeletionPending = false }: { allowDeletionPending?: boolean } = {}
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, deletionPending: true },
  });
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (project.ownerId !== userId) {
    return Response.json({ error: "Only the project owner can do this" }, { status: 403 });
  }
  if (project.deletionPending && !allowDeletionPending) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  return null;
}
