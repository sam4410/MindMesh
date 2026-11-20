import { listIntegrations } from "@/lib/integrations";
import { getCurrentIdentity } from "@/lib/project-access";

// The active workspace's connections: [{ provider, siteUrl, email, connectedAt }]. Never the token.
export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  return Response.json(await listIntegrations(identity), { headers: { "cache-control": "private, no-store" } });
}
