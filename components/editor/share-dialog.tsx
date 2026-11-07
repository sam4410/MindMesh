"use client";

import { Check, Link2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { EditorDialog } from "@/components/editor/editor-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Collaborator {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
}

interface ShareDialogProps {
  projectId: string;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function readError(res: Response) {
  const data: { error?: string } | null = await res.json().catch(() => null);
  return data?.error ?? `Request failed (${res.status})`;
}

export function ShareDialog({ projectId, isOwner, open, onOpenChange }: ShareDialogProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[] | null>(null);
  const [email, setEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const baseUrl = `/api/projects/${encodeURIComponent(projectId)}/collaborators`;

  async function load() {
    const res = await fetch(baseUrl);
    if (!res.ok) throw new Error(await readError(res));
    setCollaborators(await res.json());
  }

  // Refetch on every open so the list reflects changes made elsewhere.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(baseUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res));
        const data: Collaborator[] = await res.json();
        if (!cancelled) setCollaborators(data);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [open, baseUrl]);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || isInviting) return;
    setIsInviting(true);
    await run(async () => {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setEmail("");
      await load();
    });
    setIsInviting(false);
  }

  async function remove(collaborator: Collaborator) {
    setRemovingId(collaborator.id);
    await run(async () => {
      const res = await fetch(`${baseUrl}/${encodeURIComponent(collaborator.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readError(res));
      setCollaborators((list) => list?.filter((c) => c.id !== collaborator.id) ?? null);
    });
    setRemovingId(null);
  }

  async function copyLink() {
    await run(async () => {
      await navigator.clipboard.writeText(`${window.location.origin}/editor/${projectId}`);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <EditorDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
      title="Share project"
      description={
        isOwner
          ? "Invite people by email to collaborate on this project."
          : "Only the project owner can manage access."
      }
      footer={
        isOwner ? (
          <Button variant="outline" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy link"}
          </Button>
        ) : undefined
      }
    >
      {isOwner && (
        <form onSubmit={invite} className="flex gap-2">
          <label htmlFor="invite-email" className="sr-only">
            Email address
          </label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            autoComplete="off"
            autoFocus
          />
          <Button type="submit" disabled={!email.trim() || isInviting}>
            {isInviting ? "Inviting…" : "Invite"}
          </Button>
        </form>
      )}

      <section aria-label="Collaborators" className="space-y-2">
        <h3 className="text-xs font-medium tracking-wide text-copy-muted uppercase">
          Collaborators
        </h3>
        {collaborators === null ? (
          <p className="text-sm text-copy-muted">{error ? "Couldn't load collaborators." : "Loading…"}</p>
        ) : collaborators.length === 0 ? (
          <p className="text-sm text-copy-muted">No collaborators yet.</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {collaborators.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                {c.imageUrl ? (
                  // Clerk avatars are tiny and already sized by Clerk's CDN; next/image adds nothing here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-full" />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-medium text-copy-secondary uppercase"
                  >
                    {c.email[0]}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {c.name && <p className="truncate text-sm text-copy-primary">{c.name}</p>}
                  <p className={c.name ? "truncate text-xs text-copy-muted" : "truncate text-sm text-copy-primary"}>
                    {c.email}
                  </p>
                </div>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(c)}
                    disabled={removingId === c.id}
                    aria-label={`Remove ${c.name ?? c.email}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </EditorDialog>
  );
}
