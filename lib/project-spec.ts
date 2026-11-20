import { toSlug } from "@/lib/slug";

// A generated document's kind (Prisma's SpecKind): a technical spec, or decision records (spec 58).
export type SpecKind = "SPEC" | "ADR";

// The name a spec or ADR document downloads under, also shown in the Specs list.
export function specFilename(projectName: string, createdAt: Date, specId: string, kind: SpecKind) {
  const label = kind === "ADR" ? "adr" : "spec";
  return `${toSlug(projectName) || "project"}-${label}-${createdAt.toISOString().slice(0, 10)}-${specId}.md`;
}

// Generated specs live in Vercel Blob under one folder per project; ProjectSpec holds the metadata.
export function specBlobFolder(projectId: string) {
  return `specs/${projectId}/`;
}

export function specBlobPath(projectId: string, specId: string) {
  return `${specBlobFolder(projectId)}${specId}.md`;
}
