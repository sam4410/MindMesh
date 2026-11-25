import { randomUUID } from "node:crypto";

import { del, put } from "@vercel/blob";
import { NonRetriableError } from "inngest";

import { prisma } from "@/lib/prisma";
import { specBlobPath, type SpecKind } from "@/lib/project-spec";

// Saves a generated Markdown document (a spec, or decision records) for the generate-* tasks.
// Same split as the canvas: Markdown in private Vercel Blob, its URL in the database. Returns its ID.
export async function saveProjectDocument(projectId: string, markdown: string, kind: SpecKind) {
  // A project being deleted has already had its spec files removed, so don't add one behind it.
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletionPending: false },
    select: { id: true },
  });
  if (!project) throw new NonRetriableError("The project was deleted before the document could be saved");

  const specId = randomUUID();
  const { url } = await put(specBlobPath(projectId, specId), markdown, {
    access: "private",
    addRandomSuffix: false,
    contentType: "text/markdown; charset=utf-8",
  });
  try {
    await prisma.projectSpec.create({ data: { id: specId, projectId, filePath: url, kind } });
  } catch (err) {
    // Without its record nothing can reach or clean up the file.
    await del(url).catch((delErr) => console.warn("Couldn't delete unsaved document file", { url, error: String(delErr) }));
    throw err;
  }
  return specId;
}
