import { get } from "@vercel/blob";

import { ConfluenceError, createPage, findSpaceId, markdownToStorage } from "@/lib/atlassian/confluence";
import { getAtlassianConnection } from "@/lib/integrations";
import { getAccessibleProject, getCurrentIdentity, projectAccessError } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]/specs/[specId]/publish/confluence">;

// Space keys are letters, digits and underscores; personal spaces are "~" plus an account ID.
const SPACE_KEY = /^~?[A-Za-z0-9_-]{1,255}$/;
const PAGE_ID = /^\d{1,20}$/;
// Confluence page titles are at most 255 characters.
const MAX_TITLE = 255;

// Publishes a spec or ADR document to Confluence as a new page (spec 61) and returns { url }.
export async function POST(req: Request, ctx: Context) {
  const { projectId, specId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { spaceKey?: unknown; parentPageId?: unknown } | null;
  const spaceKey = typeof body?.spaceKey === "string" ? body.spaceKey.trim() : "";
  const parentPageId = typeof body?.parentPageId === "string" ? body.parentPageId.trim() : "";
  if (!SPACE_KEY.test(spaceKey)) return Response.json({ error: "Enter a valid Confluence space key" }, { status: 400 });
  if (parentPageId && !PAGE_ID.test(parentPageId)) {
    return Response.json({ error: "The parent page ID must be a number" }, { status: 400 });
  }

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return projectAccessError(projectId);

  // Looked up within the project, so another project's spec ID can't be used here.
  const spec = await prisma.projectSpec.findFirst({
    where: { id: specId, projectId },
    select: { id: true, filePath: true, createdAt: true, kind: true },
  });
  if (!spec) return Response.json({ error: "Spec not found" }, { status: 404 });

  let connection;
  try {
    connection = await getAtlassianConnection(identity);
  } catch (err) {
    // The token can't be decrypted (the key changed): connecting again replaces it.
    console.error("Couldn't decrypt the Atlassian token", err instanceof Error ? err.message : "unknown");
    return Response.json({ error: "Reconnect Atlassian in Settings → Integrations" }, { status: 500 });
  }
  if (!connection) return Response.json({ error: "Connect Atlassian first" }, { status: 404 });

  let markdown: string;
  try {
    const blob = await get(spec.filePath, { access: "private" });
    if (blob?.statusCode !== 200) return Response.json({ error: "Spec file not found" }, { status: 404 });
    markdown = await new Response(blob.stream).text();
  } catch (err) {
    console.error("Failed to read spec from Vercel Blob", err);
    return Response.json({ error: "Couldn't read the spec" }, { status: 502 });
  }

  const label = spec.kind === "ADR" ? "Decision records" : "Technical spec";
  const suffix = ` – ${label} (${spec.createdAt.toISOString().slice(0, 10)})`;
  // Long project names are cut so the title (plus a " (n)" retry suffix) stays within the limit.
  const title = `${project.name.slice(0, MAX_TITLE - suffix.length - 5)}${suffix}`;

  try {
    const spaceId = await findSpaceId(connection, spaceKey);
    const url = await createPage(connection, {
      spaceId,
      title,
      parentId: parentPageId || undefined,
      storage: markdownToStorage(markdown),
    });
    await prisma.projectSpec.update({ where: { id: spec.id }, data: { publishedUrl: url } });
    return Response.json({ url });
  } catch (err) {
    if (err instanceof ConfluenceError) return Response.json({ error: err.message }, { status: err.status });
    console.error("Confluence publish failed", err);
    return Response.json({ error: "Couldn't publish to Confluence. Try again." }, { status: 502 });
  }
}
