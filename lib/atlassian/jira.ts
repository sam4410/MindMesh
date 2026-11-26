import type { AdfDocument } from "@/lib/atlassian/adf";
import { atlassianAuthHeader, type AtlassianConnection } from "@/lib/integrations";

// Jira Cloud issue creation (spec 62).

const TIMEOUT_MS = 10_000;
// Jira summaries are at most 255 characters.
const MAX_SUMMARY = 255;

type IssueResult = { ok: true; key: string; url: string } | { ok: false; error: string };

// "Implement Order Service", on one line and within Jira's limit.
export function issueSummary(label: string) {
  return `Implement ${label.replace(/\s+/g, " ").trim()}`.slice(0, MAX_SUMMARY);
}

// Jira's 400 body: { errorMessages: string[], errors: { field: message } }.
function jiraErrorMessage(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { errorMessages, errors } = body as { errorMessages?: unknown; errors?: unknown };
  const messages = [
    ...(Array.isArray(errorMessages) ? errorMessages.filter((m): m is string => typeof m === "string") : []),
    ...(errors && typeof errors === "object"
      ? Object.entries(errors).flatMap(([field, message]) => (typeof message === "string" ? [`${field}: ${message}`] : []))
      : []),
  ];
  return messages.length ? messages.join("; ").slice(0, 300) : null;
}

// Creates one issue. Never throws: the route reports each failure and carries on with the rest.
export async function createJiraIssue(
  connection: AtlassianConnection,
  issue: { projectKey: string; issueType: string; summary: string; description: AdfDocument }
): Promise<IssueResult> {
  let res: Response;
  try {
    res = await fetch(`${connection.siteUrl}/rest/api/3/issue`, {
      method: "POST",
      headers: {
        authorization: atlassianAuthHeader(connection.email, connection.apiToken),
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          project: { key: issue.projectKey },
          issuetype: { name: issue.issueType },
          summary: issue.summary,
          description: issue.description,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    console.warn("Jira request failed", { error: err instanceof Error ? err.name : "unknown" });
    return { ok: false, error: timedOut ? "Jira didn't respond in time." : "Couldn't reach Jira." };
  }

  if (res.ok) {
    const { key } = (await res.json()) as { key: string };
    return { ok: true, key, url: `${connection.siteUrl}/browse/${encodeURIComponent(key)}` };
  }
  console.warn("Jira issue creation failed", { status: res.status });
  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "Atlassian rejected the request. Check the connection and Jira project permissions." };
  }
  // A 400 names the problem, e.g. "project: valid project is required" or an unknown issue type.
  const message = jiraErrorMessage(await res.json().catch(() => null));
  return { ok: false, error: message ?? `Jira refused the issue (HTTP ${res.status}).` };
}
