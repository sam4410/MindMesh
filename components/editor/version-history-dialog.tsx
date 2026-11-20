"use client";

import { History, Loader2, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { EditorDialog } from "@/components/editor/editor-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isCanvasSnapshot, type CanvasSnapshot } from "@/lib/canvas-snapshot";
import { cn } from "@/lib/utils";

// The version API's name limit (spec 55).
const MAX_NAME_LENGTH = 80;
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const RELATIVE_FORMAT = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

interface VersionSummary {
  id: string;
  name: string;
  createdByName: string;
  createdAt: string;
  nodeCount: number;
}

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; versions: VersionSummary[] };

// A row waiting for the second click of Restore or Delete.
type Pending = { id: string; action: "restore" | "delete" } | null;

interface VersionHistoryDialogProps {
  projectId: string;
  // Owners and admins see Delete; the route enforces it.
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // False until the canvas has loaded; saving and restoring wait for it.
  isCanvasLoaded: boolean;
  getCanvas: () => CanvasSnapshot | null;
  // Replaces the live canvas for everyone (the template import path); false when it isn't connected.
  onRestore: (canvas: CanvasSnapshot) => boolean;
}

// "3 minutes ago", "yesterday"; under a minute is "just now".
function relativeTime(date: Date, now: number) {
  const seconds = Math.round((date.getTime() - now) / 1000);
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return RELATIVE_FORMAT.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

// POSTs a version; throws with the API's message (e.g. the 409 limit) when there is one.
async function createVersion(projectId: string, name: string, canvas: CanvasSnapshot) {
  const res = await fetch(`/api/projects/${projectId}/versions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, nodes: canvas.nodes, edges: canvas.edges }),
  });
  const body = (await res.json().catch(() => null)) as (VersionSummary & { error?: string }) | null;
  if (!res.ok || !body) {
    throw new Error(res.status === 409 && body?.error ? body.error : "Couldn't save the version. Try again.");
  }
  return body;
}

export function VersionHistoryDialog({
  projectId,
  canManage,
  open,
  onOpenChange,
  isCanvasLoaded,
  getCanvas,
  onRestore,
}: VersionHistoryDialogProps) {
  // The dialog is remounted on each open, so these start fresh every time.
  const [name, setName] = useState(() => `Version ${DATE_TIME_FORMAT.format(new Date())}`);
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [busy, setBusy] = useState<"saving" | "restoring" | "deleting" | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  // The row being deleted, which shows a spinner until the request finishes (~2.5 s with the Blob delete).
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/projects/${projectId}/versions`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Versions failed with status ${res.status}`);
        return res.json() as Promise<{ versions: VersionSummary[] }>;
      })
      .then(({ versions }) => setList({ status: "ready", versions }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setList({ status: "error" });
      });
    return () => controller.abort();
  }, [open, projectId, reloadCount]);

  function addToList(version: VersionSummary) {
    setList((current) =>
      current.status === "ready" ? { status: "ready", versions: [version, ...current.versions] } : current
    );
  }

  async function saveVersion(event: FormEvent) {
    event.preventDefault();
    const canvas = getCanvas();
    const trimmed = name.trim();
    if (!canvas || !trimmed || busy) return;
    setBusy("saving");
    setNotice(null);
    try {
      const version = await createVersion(projectId, trimmed, canvas);
      addToList(version);
      setName(`Version ${DATE_TIME_FORMAT.format(new Date())}`);
      setNotice({ tone: "success", text: `Saved "${version.name}".` });
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function restore(version: VersionSummary) {
    const current = getCanvas();
    if (!current || busy) return;
    setBusy("restoring");
    setPending(null);
    setNotice(null);
    try {
      // The current canvas is kept first, so the restore itself can be undone.
      const backup = await createVersion(projectId, `Before restore – ${DATE_TIME_FORMAT.format(new Date())}`, current);
      addToList(backup);

      const res = await fetch(`/api/projects/${projectId}/versions/${version.id}`);
      const snapshot: unknown = res.ok ? await res.json() : null;
      if (!isCanvasSnapshot(snapshot)) throw new Error("Couldn't load that version. Try again.");
      if (!onRestore(snapshot)) throw new Error("The canvas isn't connected. Try again in a moment.");
      onOpenChange(false);
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove(version: VersionSummary) {
    if (busy) return;
    setBusy("deleting");
    setDeletingId(version.id);
    setPending(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions/${version.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed with status ${res.status}`);
      setList((current) =>
        current.status === "ready"
          ? { status: "ready", versions: current.versions.filter((item) => item.id !== version.id) }
          : current
      );
    } catch (err) {
      console.error(err);
      setNotice({ tone: "error", text: "Couldn't delete the version. Try again." });
    } finally {
      setBusy(null);
      setDeletingId(null);
    }
  }

  const canSave = isCanvasLoaded && name.trim().length > 0 && busy === null;

  return (
    <EditorDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Version history"
      description="Save the canvas as a named version, or restore an earlier one."
      className="sm:max-w-lg"
    >
      <form onSubmit={saveVersion} className="flex items-center gap-2">
        <label htmlFor="version-name" className="sr-only">
          Version name
        </label>
        <Input
          id="version-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
          className="h-9 rounded-xl"
        />
        <Button
          type="submit"
          disabled={!canSave}
          title={isCanvasLoaded ? undefined : "The canvas is still loading"}
          className="h-9 shrink-0 rounded-xl"
        >
          {busy === "saving" ? <Loader2 className="animate-spin" /> : <Save />}
          Save version
        </Button>
      </form>
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={notice.tone === "error" ? "-mt-2 text-xs text-error" : "-mt-2 text-xs text-success"}
        >
          {notice.text}
        </p>
      )}

      <ScrollArea className="-mx-6 h-[min(50vh,420px)] border-y border-surface-border bg-surface">
        {list.status === "loading" && (
          <p role="status" className="flex items-center justify-center gap-2 p-6 text-xs text-copy-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading versions…
          </p>
        )}
        {list.status === "error" && (
          <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-xs text-copy-muted">Couldn&apos;t load the versions.</p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                setList({ status: "loading" });
                setReloadCount((count) => count + 1);
              }}
            >
              Try again
            </Button>
          </div>
        )}
        {list.status === "ready" && list.versions.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-subtle">
              <History className="h-6 w-6 text-brand" />
            </span>
            <p className="text-sm font-medium text-copy-primary">No versions yet</p>
            <p className="text-xs text-copy-muted">Saved versions of this canvas will appear here.</p>
          </div>
        )}
        {list.status === "ready" && list.versions.length > 0 && (
          <ul className="flex flex-col gap-2 px-6 py-4">
            {list.versions.map((version) => {
              const createdAt = new Date(version.createdAt);
              const isPending = pending?.id === version.id;
              const isDeleting = deletingId === version.id;
              return (
                <li
                  key={version.id}
                  aria-busy={isDeleting}
                  className={cn(
                    "rounded-2xl border border-surface-border bg-elevated px-3 py-2.5 transition-opacity",
                    isDeleting && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-copy-primary" title={version.name}>
                        {version.name}
                      </p>
                      <p className="truncate text-xs text-copy-muted">
                        {version.createdByName} ·{" "}
                        <time dateTime={version.createdAt} title={DATE_TIME_FORMAT.format(createdAt)}>
                          {relativeTime(createdAt, now)}
                        </time>{" "}
                        · {version.nodeCount} {version.nodeCount === 1 ? "node" : "nodes"}
                      </p>
                    </div>
                    {isDeleting && (
                      <span role="status" className="flex shrink-0 items-center gap-1.5 text-xs text-copy-muted">
                        <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                        Deleting…
                      </span>
                    )}
                    {!isPending && !isDeleting && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          disabled={!isCanvasLoaded || busy !== null}
                          onClick={() => setPending({ id: version.id, action: "restore" })}
                        >
                          <RotateCcw />
                          Restore
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-xl text-copy-muted hover:text-error"
                            disabled={busy !== null}
                            aria-label={`Delete ${version.name}`}
                            title="Delete version"
                            onClick={() => setPending({ id: version.id, action: "delete" })}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  {isPending && (
                    <div
                      role="group"
                      aria-label={pending.action === "restore" ? "Confirm restore" : "Confirm delete"}
                      className="mt-2 flex items-center gap-2 border-t border-surface-border pt-2"
                    >
                      <p className="min-w-0 flex-1 text-xs text-copy-secondary">
                        {pending.action === "restore"
                          ? "Replace the canvas for everyone in this project?"
                          : "Delete this version? This can't be undone."}
                      </p>
                      <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setPending(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant={pending.action === "delete" ? "destructive" : "default"}
                        className="rounded-xl"
                        autoFocus
                        onClick={() => void (pending.action === "restore" ? restore(version) : remove(version))}
                      >
                        {pending.action === "restore" ? "Replace canvas" : "Delete"}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
      {busy === "restoring" && (
        <p role="status" className="-mt-2 flex items-center gap-2 text-xs text-copy-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Saving the current canvas, then restoring…
        </p>
      )}
    </EditorDialog>
  );
}
