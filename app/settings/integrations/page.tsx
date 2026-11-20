import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AtlassianCard } from "@/components/settings/atlassian-card";
import { canManageIntegrations, listIntegrations } from "@/lib/integrations";
import { getCurrentIdentity } from "@/lib/project-access";

// Workspace integrations (spec 60): the Atlassian site that later specs publish to.
export default function IntegrationsPage() {
  return (
    <main className="flex min-h-screen justify-center bg-base px-4 py-10">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <Link
          href="/editor"
          className="flex w-fit items-center gap-1.5 rounded-md text-sm text-copy-muted outline-none hover:text-copy-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-copy-primary">Integrations</h1>
          <p className="text-sm text-copy-muted">Connect tools for this workspace. Everyone in it can use them.</p>
        </div>
        {/* Cache Components: the session is runtime data, so it renders inside Suspense. */}
        <Suspense fallback={<div className="h-56 rounded-3xl border border-surface-border bg-surface" />}>
          <Integrations />
        </Suspense>
      </div>
    </main>
  );
}

async function Integrations() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect(process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL!);

  const integrations = await listIntegrations(identity);
  return (
    <AtlassianCard
      connection={integrations.find((integration) => integration.provider === "ATLASSIAN") ?? null}
      canManage={canManageIntegrations(identity)}
    />
  );
}
