import { del, put } from "@vercel/blob";

import { isCanvasSnapshot, serializeCanvas } from "@/lib/canvas-snapshot";
import { getAccessibleProject, getCurrentIdentity, projectAccessError } from "@/lib/project-access";
import { versionBlobPath } from "@/lib/project-version";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]/versions">;

// Saving refuses the 51st version, so the list below always shows them all.
const MAX_VERSIONS = 50;
const MAX_NAME_LENGTH = 80;
// Vercel functions reject request bodies over 4.5 MB (same limit as the canvas PUT).
const MAX_BODY_LENGTH = 4 * 1024 * 1024;

const SUMMARY_FIELDS = { id: true, name: true, createdByName: true, createdAt: true, nodeCount: true } as const;

// Saves the given canvas as a named version.
export async function POST(req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return projectAccessError(projectId);

  const text = await req.text();
  if (text.length > MAX_BODY_LENGTH) {
    return Response.json({ error: "Canvas is too large to save" }, { status: 413 });
  }
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Falls through to the checks below.
  }
  const { name: rawName, nodes, edges } = (body ?? {}) as { name?: unknown; nodes?: unknown; edges?: unknown };
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
    return Response.json({ error: `Name must be 1–${MAX_NAME_LENGTH} characters` }, { status: 400 });
  }
  const canvas = { nodes, edges };
  if (!isCanvasSnapshot(canvas)) return Response.json({ error: "Invalid canvas" }, { status: 400 });

  // shortcut: count-then-create, so two saves at the same moment could both pass at 49.
  const count = await prisma.projectVersion.count({ where: { projectId } });
  if (count >= MAX_VERSIONS) {
    return Response.json({ error: "Version limit reached. Delete an old version first." }, { status: 409 });
  }

  // The ID is chosen first because the Blob path contains it.
  const id = crypto.randomUUID();
  let url: string;
  try {
    ({ url } = await put(versionBlobPath(projectId, id), serializeCanvas(canvas.nodes, canvas.edges), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
    }));
  } catch (err) {
    console.error("Failed to upload version to Vercel Blob", err);
    return Response.json({ error: "Couldn't save the version" }, { status: 502 });
  }

  try {
    const version = await prisma.projectVersion.create({
      data: {
        id,
        projectId,
        name,
        createdById: identity.userId,
        createdByName: identity.name,
        filePath: url,
        nodeCount: canvas.nodes.length,
      },
      select: SUMMARY_FIELDS,
    });
    return Response.json(version, { status: 201 });
  } catch (err) {
    console.error("Failed to create version record", err);
    // Without its row nothing points at this file, so it would never be cleaned up.
    await del(url).catch((delErr) => console.error("Failed to delete orphaned version blob", delErr));
    return Response.json({ error: "Couldn't save the version" }, { status: 500 });
  }
}

// Lists a project's versions, newest first: metadata only, the snapshot comes from the version route.
export async function GET(_req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return projectAccessError(projectId);

  const versions = await prisma.projectVersion.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: MAX_VERSIONS,
    select: SUMMARY_FIELDS,
  });
  return Response.json({ versions }, { headers: { "cache-control": "private, no-store" } });
}
