"use client";

import { CheckCircle2, ExternalLink, Loader2, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { IntegrationSummary } from "@/lib/integrations";

const API_TOKEN_PAGE = "https://id.atlassian.com/manage-profile/security/api-tokens";
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

interface AtlassianCardProps {
  connection: IntegrationSummary | null;
  // Organization admins, or anyone in a personal workspace; the routes enforce it.
  canManage: boolean;
}

// The workspace's Atlassian (Jira and Confluence) connection: its site and email, or a form to connect.
export function AtlassianCard({ connection, canManage }: AtlassianCardProps) {
  const router = useRouter();
  const [siteUrl, setSiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [busy, setBusy] = useState<"connecting" | "disconnecting" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy("connecting");
    setError(null);
    try {
      const res = await fetch("/api/integrations/atlassian", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteUrl, email, apiToken }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Couldn't connect. Try again.");
      }
      // The token leaves the page as soon as it's saved.
      setApiToken("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (busy) return;
    setBusy("disconnecting");
    setError(null);
    try {
      const res = await fetch("/api/integrations/atlassian", { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't disconnect. Try again.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="atlassian-title"
      className="flex flex-col gap-5 rounded-3xl border border-surface-border bg-surface p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="atlassian-title" className="text-base font-semibold text-copy-primary">
            Atlassian
          </h2>
          <p className="text-sm text-copy-muted">Jira and Confluence, connected with an API token.</p>
        </div>
        {connection && (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Connected
          </span>
        )}
      </div>

      {connection ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-copy-muted">Site</dt>
          <dd className="truncate text-copy-primary">{connection.siteUrl}</dd>
          <dt className="text-copy-muted">Email</dt>
          <dd className="truncate text-copy-primary">{connection.email}</dd>
          <dt className="text-copy-muted">Connected</dt>
          <dd className="text-copy-primary">
            <time dateTime={connection.connectedAt}>{DATE_FORMAT.format(new Date(connection.connectedAt))}</time>
          </dd>
        </dl>
      ) : canManage ? (
        <form onSubmit={connect} className="flex flex-col gap-3">
          <Field label="Site URL" htmlFor="atlassian-site">
            <Input
              id="atlassian-site"
              value={siteUrl}
              onChange={(event) => setSiteUrl(event.target.value)}
              placeholder="https://your-site.atlassian.net"
              autoComplete="url"
              required
              className="rounded-xl"
            />
          </Field>
          <Field label="Email" htmlFor="atlassian-email">
            <Input
              id="atlassian-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
              className="rounded-xl"
            />
          </Field>
          <Field label="API token" htmlFor="atlassian-token">
            <Input
              id="atlassian-token"
              type="password"
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              autoComplete="off"
              required
              className="rounded-xl"
            />
            <a
              href={API_TOKEN_PAGE}
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex w-fit items-center gap-1 text-xs text-brand underline-offset-2 hover:underline"
            >
              Create an API token in your Atlassian account
              <ExternalLink className="h-3 w-3" />
            </a>
          </Field>
          <Button type="submit" disabled={busy !== null} className="mt-1 w-fit rounded-xl">
            {busy === "connecting" && <Loader2 className="animate-spin" />}
            {busy === "connecting" ? "Connecting…" : "Connect Atlassian"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-copy-muted">Not connected. Ask an organization admin to connect your Atlassian site.</p>
      )}

      {connection && canManage && (
        <Button
          variant="outline"
          onClick={() => void disconnect()}
          disabled={busy !== null}
          className="w-fit rounded-xl hover:text-error"
        >
          {busy === "disconnecting" ? <Loader2 className="animate-spin" /> : <Unplug />}
          {busy === "disconnecting" ? "Disconnecting…" : "Disconnect"}
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </section>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-copy-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}
