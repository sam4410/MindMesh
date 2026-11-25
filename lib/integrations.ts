import { decryptSecret } from "@/lib/crypto";
import type { Identity } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

// What GET /api/integrations returns per connection (spec 60); never the token.
export interface IntegrationSummary {
  provider: "ATLASSIAN";
  siteUrl: string;
  email: string;
  // When it was last connected (a reconnect updates the row).
  connectedAt: string;
}

// The workspace an integration belongs to: the active organization, or the user's personal one.
// Same account ID billing will use (specs 34–39).
export function workspaceAccountId(identity: Identity) {
  return identity.orgId ?? identity.userId;
}

// Connecting and disconnecting: organization admins, or anyone in their personal workspace.
export function canManageIntegrations(identity: Identity) {
  return !identity.orgId || identity.orgRole === "org:admin";
}

export async function listIntegrations(identity: Identity): Promise<IntegrationSummary[]> {
  const rows = await prisma.integration.findMany({
    where: { billingAccountId: workspaceAccountId(identity) },
    orderBy: { provider: "asc" },
    // Selecting fields keeps encryptedToken out of the query result altogether.
    select: { provider: true, siteUrl: true, email: true, updatedAt: true },
  });
  return rows.map((row) => ({
    provider: row.provider,
    siteUrl: row.siteUrl,
    email: row.email,
    connectedAt: row.updatedAt.toISOString(),
  }));
}

// Only Atlassian Cloud sites, so the verification request can't be pointed anywhere else.
const ATLASSIAN_SITE = /^https:\/\/[a-z0-9][a-z0-9-]{0,62}\.atlassian\.net$/;

// "https://Acme.atlassian.net/" → "https://acme.atlassian.net"; null when it isn't an Atlassian site.
export function normalizeAtlassianSite(value: string) {
  const site = value.trim().toLowerCase().replace(/\/+$/, "");
  return ATLASSIAN_SITE.test(site) ? site : null;
}

export function atlassianAuthHeader(email: string, apiToken: string) {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
}

const VERIFY_TIMEOUT_MS = 10_000;

// True when the site accepts these credentials (GET /rest/api/3/myself). Never logs the token.
export async function verifyAtlassian(siteUrl: string, email: string, apiToken: string) {
  try {
    const res = await fetch(`${siteUrl}/rest/api/3/myself`, {
      headers: { authorization: atlassianAuthHeader(email, apiToken), accept: "application/json" },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      redirect: "manual",
    });
    if (!res.ok) console.warn("Atlassian verification refused", { siteUrl, status: res.status });
    return res.ok;
  } catch (err) {
    console.warn("Atlassian verification failed", { siteUrl, error: err instanceof Error ? err.name : "unknown" });
    return false;
  }
}

// A stored Atlassian connection with its token decrypted, for server-side calls only (spec 61).
export interface AtlassianConnection {
  siteUrl: string;
  email: string;
  apiToken: string;
}

// The active workspace's Atlassian connection, or null when none is stored.
export async function getAtlassianConnection(identity: Identity): Promise<AtlassianConnection | null> {
  const row = await prisma.integration.findUnique({
    where: { billingAccountId_provider: { billingAccountId: workspaceAccountId(identity), provider: "ATLASSIAN" } },
    select: { siteUrl: true, email: true, encryptedToken: true },
  });
  if (!row) return null;
  return { siteUrl: row.siteUrl, email: row.email, apiToken: decryptSecret(row.encryptedToken) };
}
