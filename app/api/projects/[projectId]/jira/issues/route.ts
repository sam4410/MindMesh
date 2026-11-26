import { z } from "zod";

import { buildIssueDescription } from "@/lib/atlassian/adf";
import { createJiraIssue, issueSummary } from "@/lib/atlassian/jira";
import { getCloudService, serviceFullName } from "@/lib/cloud-services";
import { getAtlassianConnection } from "@/lib/integrations";
import { getAccessibleProject, getCurrentIdentity, projectAccessError } from "@/lib/project-access";

type Context = RouteContext<"/api/projects/[projectId]/jira/issues">;

const MAX_COMPONENTS = 25;
// Issues created at once: 25 one at a time could take 250 s with 10-second timeouts.
const CONCURRENCY = 5;

const connectionList = z.array(z.string().max(1200)).max(100);

// The client sends component details from the canvas; the server builds the descriptions.
const requestSchema = z.object({
  // Jira project keys start with a letter and hold letters, digits and underscores.
  jiraProjectKey: z
    .string()
    .trim()
    .regex(/^[A-Za-z][A-Za-z0-9_]{0,254}$/, "Enter a valid Jira project key")
    .transform((key) => key.toUpperCase()),
  issueType: z.string().trim().min(1).max(60).default("Task"),
  components: z
    .array(
      z.object({
        nodeId: z.string().min(1).max(120),
        label: z.string().trim().min(1).max(500),
        // A cloud service ID (lib/cloud-services.ts); unknown IDs are ignored.
        service: z.string().max(80).optional(),
        incoming: connectionList,
        outgoing: connectionList,
      })
    )
    .min(1, "Choose at least one component")
    .max(MAX_COMPONENTS, `Choose at most ${MAX_COMPONENTS} components`),
});

// Creates one Jira issue per component (spec 62) and returns
// { created: [{ nodeId, key, url }], failed: [{ nodeId, error }] }. A failed issue doesn't stop the rest.
export async function POST(req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const { jiraProjectKey, issueType, components } = parsed.data;

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return projectAccessError(projectId);

  let connection;
  try {
    connection = await getAtlassianConnection(identity);
  } catch (err) {
    // The token can't be decrypted (the key changed): connecting again replaces it.
    console.error("Couldn't decrypt the Atlassian token", err instanceof Error ? err.message : "unknown");
    return Response.json({ error: "Reconnect Atlassian in Settings → Integrations" }, { status: 500 });
  }
  if (!connection) return Response.json({ error: "Connect Atlassian first" }, { status: 404 });

  const results: Awaited<ReturnType<typeof createJiraIssue>>[] = [];
  for (let start = 0; start < components.length; start += CONCURRENCY) {
    const batch = components.slice(start, start + CONCURRENCY);
    results.push(
      ...(await Promise.all(
        batch.map((component) => {
          const service = getCloudService(component.service);
          return createJiraIssue(connection, {
            projectKey: jiraProjectKey,
            issueType,
            summary: issueSummary(component.label),
            description: buildIssueDescription({
              projectName: project.name,
              label: component.label,
              service: service ? serviceFullName(service) : undefined,
              incoming: component.incoming,
              outgoing: component.outgoing,
            }),
          });
        })
      ))
    );
  }

  const created: { nodeId: string; key: string; url: string }[] = [];
  const failed: { nodeId: string; error: string }[] = [];
  results.forEach((result, index) => {
    const { nodeId } = components[index];
    if (result.ok) created.push({ nodeId, key: result.key, url: result.url });
    else failed.push({ nodeId, error: result.error });
  });
  return Response.json({ created, failed });
}
