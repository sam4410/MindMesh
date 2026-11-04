import { del, get, put } from "@vercel/blob";

import { canvasBlobPath, isCanvasSnapshot } from "@/lib/canvas-snapshot";
import { getAccessibleProject, getCurrentIdentity } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]/canvas">;

// Vercel functions reject request bodies over 4.5 MB.
const MAX_CANVAS_LENGTH = 4 * 1024 * 1024;

export async function GET(_req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (!project.canvasJsonPath) return new Response(null, { status: 204 });

  try {
    // useCache: false because saves overwrite the same path and the CDN copy can lag behind.
    const blob = await get(project.canvasJsonPath, { access: "private", useCache: false });
    if (blob?.statusCode !== 200) return new Response(null, { status: 204 });
    return new Response(blob.stream, {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("Failed to read canvas from Vercel Blob", err);
    return Response.json({ error: "Couldn't load the canvas" }, { status: 502 });
  }
}

export async function PUT(req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const body = await req.text();
  if (body.length > MAX_CANVAS_LENGTH) {
    return Response.json({ error: "Canvas is too large to save" }, { status: 413 });
  }
  let canvas: unknown = null;
  try {
    canvas = JSON.parse(body);
  } catch {
    // Falls through to the shape check below.
  }
  if (!isCanvasSnapshot(canvas)) {
    return Response.json({ error: "Invalid canvas" }, { status: 400 });
  }

  try {
    const { url } = await put(canvasBlobPath(projectId), body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    const { count } = await prisma.project.updateMany({
      where: { id: projectId, deletionPending: false },
      data: { canvasJsonPath: url },
    });
    // The project was deleted during the upload, so nothing else would clean this blob up.
    if (count === 0) {
      await del(url);
      return Response.json({ error: "Project not found" }, { status: 404 });
    }
  } catch (err) {
    console.error("Failed to save canvas", err);
    return Response.json({ error: "Couldn't save the canvas" }, { status: 502 });
  }
  return new Response(null, { status: 204 });
}
