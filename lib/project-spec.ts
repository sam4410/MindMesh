import { toSlug } from "@/lib/slug";

// The name a spec downloads under, also shown in the Specs list.
export function specFilename(projectName: string, createdAt: Date, specId: string) {
  return `${toSlug(projectName) || "project"}-spec-${createdAt.toISOString().slice(0, 10)}-${specId}.md`;
}

// Generated specs live in Vercel Blob under one folder per project; ProjectSpec holds the metadata.
export function specBlobFolder(projectId: string) {
  return `specs/${projectId}/`;
}

export function specBlobPath(projectId: string, specId: string) {
  return `${specBlobFolder(projectId)}${specId}.md`;
}
