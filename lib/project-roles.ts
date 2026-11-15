// Client-safe: lib/project-access.ts loads Clerk's server SDK and Prisma, so UI code imports roles from here.
export type ProjectRole = "owner" | "admin" | "member" | "collaborator";

// Owners and organization admins can rename, delete, and share a project; everyone with access can edit it.
export function canManageProject(role: ProjectRole) {
  return role === "owner" || role === "admin";
}
