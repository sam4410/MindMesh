import { auth, currentUser } from "@clerk/nextjs/server";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { canManageProject, type ProjectRole } from "@/lib/project-roles";

export { canManageProject, type ProjectRole };

export interface Identity {
  userId: string;
  email: string | undefined;
  name: string;
  imageUrl: string;
  // Active Clerk organization and the user's role in it; null in the personal workspace.
  orgId: string | null;
  orgRole: string | null;
}

// Cached per request: the editor layout and workspace page both need it, and currentUser() calls Clerk's API.
export const getCurrentIdentity = cache(async (): Promise<Identity | null> => {
  const [user, { orgId, orgRole }] = await Promise.all([currentUser(), auth()]);
  if (!user) return null;
  // Collaborator emails are matched lowercased.
  const email = user.primaryEmailAddress?.emailAddress.trim().toLowerCase();
  return {
    userId: user.id,
    email,
    name: user.fullName ?? user.username ?? email ?? "Anonymous",
    imageUrl: user.imageUrl,
    orgId: orgId ?? null,
    orgRole: orgRole ?? null,
  };
});

// Returns the project if the user owns a personal project, collaborates on it, or belongs to its
// active organization; organization ownership alone does not grant access outside that organization.
export async function getAccessibleProject(
  projectId: string,
  identity: Identity,
  { includeDeletionPending = false }: { includeDeletionPending?: boolean } = {}
) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      ...(includeDeletionPending ? {} : { deletionPending: false }),
      OR: [
        { ownerId: identity.userId, organizationId: null },
        ...(identity.email ? [{ collaborators: { some: { email: identity.email } } }] : []),
        ...(identity.orgId ? [{ organizationId: identity.orgId }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      ownerId: true,
      organizationId: true,
      canvasJsonPath: true,
      // Design context; read with getDesignContext (lib/design-context.ts).
      cloudProvider: true,
      architectureStyle: true,
      industry: true,
      projectType: true,
      // GitHub link (spec 63), passed to spec and ADR generation.
      repositoryUrl: true,
    },
  });
}

// For read routes after getAccessibleProject returned null: 403 when the project exists but isn't
// shared with the user, otherwise 404.
export async function projectAccessError(projectId: string) {
  const exists = await prisma.project.count({ where: { id: projectId, deletionPending: false } });
  return exists
    ? Response.json({ error: "You don't have access to this project" }, { status: 403 })
    : Response.json({ error: "Project not found" }, { status: 404 });
}

// The user's role on a project they can access (call after getAccessibleProject). Access that
// isn't ownership or the active organization came through the collaborator email.
export function getProjectRole(
  project: { ownerId: string; organizationId: string | null },
  identity: Identity
): ProjectRole {
  if (
    project.ownerId === identity.userId &&
    (project.organizationId === null || project.organizationId === identity.orgId)
  ) {
    return "owner";
  }
  if (project.organizationId && project.organizationId === identity.orgId) {
    return identity.orgRole === "org:admin" ? "admin" : "member";
  }
  return "collaborator";
}

// For API routes that rename, delete, or share: returns an error response unless the signed-in user
// is the owner or an organization admin. No access at all stays a 404, so project IDs can't be probed.
export async function requireProjectManager(
  projectId: string,
  { allowDeletionPending = false }: { allowDeletionPending?: boolean } = {}
) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getAccessibleProject(projectId, identity, {
    includeDeletionPending: allowDeletionPending,
  });
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (!canManageProject(getProjectRole(project, identity))) {
    return Response.json({ error: "Only the owner or an admin can do this" }, { status: 403 });
  }
  return null;
}
