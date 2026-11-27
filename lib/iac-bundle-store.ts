import { randomUUID } from "node:crypto";

import { del, put } from "@vercel/blob";
import { NonRetriableError } from "inngest";

import { iacBlobPath, zipIacFiles, type IacFile, type IacFormat } from "@/lib/iac-bundle";
import { prisma } from "@/lib/prisma";

// Zips validated files into private Vercel Blob and records the bundle (spec 66), like
// saveProjectDocument does for specs. Returns the bundle ID.
export async function saveIacBundle(projectId: string, format: IacFormat, files: readonly IacFile[]) {
  // A project being deleted has already had its files removed, so don't add one behind it.
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletionPending: false },
    select: { id: true },
  });
  if (!project) throw new NonRetriableError("The project was deleted before the code could be saved");

  const bundleId = randomUUID();
  const { url } = await put(iacBlobPath(projectId, bundleId), Buffer.from(zipIacFiles(files)), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/zip",
  });
  try {
    await prisma.iacBundle.create({ data: { id: bundleId, projectId, format, filePath: url, fileCount: files.length } });
  } catch (err) {
    // Without its record nothing can reach or clean up the file.
    await del(url).catch((delErr) => console.warn("Couldn't delete unsaved IaC bundle", { url, error: String(delErr) }));
    throw err;
  }
  return bundleId;
}
