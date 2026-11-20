import { encryptSecret } from "@/lib/crypto";
import {
  canManageIntegrations,
  normalizeAtlassianSite,
  verifyAtlassian,
  workspaceAccountId,
  type IntegrationSummary,
} from "@/lib/integrations";
import { getCurrentIdentity } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

// shortcut: API tokens only; move to Atlassian OAuth 2.0 when customers ask for per-user permissions.

const MAX_EMAIL_LENGTH = 320;
const MAX_TOKEN_LENGTH = 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getManager() {
  const identity = await getCurrentIdentity();
  if (!identity) return { denied: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageIntegrations(identity)) {
    return { denied: Response.json({ error: "Only an organization admin can manage integrations" }, { status: 403 }) };
  }
  return { identity };
}

// Connects (or reconnects) the workspace's Atlassian site. Body: { siteUrl, email, apiToken }.
export async function PUT(req: Request) {
  const { identity, denied } = await getManager();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const siteUrl = typeof body?.siteUrl === "string" ? normalizeAtlassianSite(body.siteUrl) : null;
  if (!siteUrl) {
    return Response.json({ error: "Site URL must look like https://your-site.atlassian.net" }, { status: 400 });
  }
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const apiToken = typeof body?.apiToken === "string" ? body.apiToken.trim() : "";
  if (!apiToken || apiToken.length > MAX_TOKEN_LENGTH) {
    return Response.json({ error: "Enter an API token" }, { status: 400 });
  }

  if (!(await verifyAtlassian(siteUrl, email, apiToken))) {
    return Response.json({ error: "Couldn't connect with these details" }, { status: 400 });
  }

  const billingAccountId = workspaceAccountId(identity);
  const data = { siteUrl, email, encryptedToken: encryptSecret(apiToken), createdById: identity.userId };
  const row = await prisma.integration.upsert({
    where: { billingAccountId_provider: { billingAccountId, provider: "ATLASSIAN" } },
    create: { billingAccountId, provider: "ATLASSIAN", ...data },
    update: data,
    select: { provider: true, siteUrl: true, email: true, updatedAt: true },
  });
  const summary: IntegrationSummary = {
    provider: row.provider,
    siteUrl: row.siteUrl,
    email: row.email,
    connectedAt: row.updatedAt.toISOString(),
  };
  return Response.json(summary);
}

// Disconnects the workspace's Atlassian site.
export async function DELETE() {
  const { identity, denied } = await getManager();
  if (denied) return denied;

  await prisma.integration.deleteMany({
    where: { billingAccountId: workspaceAccountId(identity), provider: "ATLASSIAN" },
  });
  return new Response(null, { status: 204 });
}
