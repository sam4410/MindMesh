import { toSlug } from "@/lib/slug";

// The name a spec downloads under, also shown in the Specs list, e.g. "shop-api-spec-2026-11-09.md".
export function specFilename(projectName: string, createdAt: Date) {
  return `${toSlug(projectName) || "project"}-spec-${createdAt.toISOString().slice(0, 10)}.md`;
}

// Generated specs live in Vercel Blob under one folder per project; ProjectSpec holds the metadata.
export function specBlobFolder(projectId: string) {
  return `specs/${projectId}/`;
}

export function specBlobPath(projectId: string, specId: string) {
  return `${specBlobFolder(projectId)}${specId}.md`;
}
