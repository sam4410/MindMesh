"use client";

import { CheckCircle2, Download, ExternalLink, FileText, Lightbulb, ListChecks, Loader2, Send, Sparkles } from "lucide-react";
import { createElement, useEffect, useState, type FormEvent } from "react";
import Markdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";

import { DesignDecisionsDialog } from "@/components/editor/design-decisions-dialog";
import { EditorDialog } from "@/components/editor/editor-dialog";
import { RunPoller } from "@/components/editor/run-poller";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatEntry } from "@/hooks/use-ai-chat";
import { useDocumentRun, type DocumentRunMessages } from "@/hooks/use-document-run";
import type { CanvasSnapshot } from "@/lib/canvas-snapshot";
import type { SpecKind } from "@/lib/project-spec";
import { cn } from "@/lib/utils";
import { SPEC_MAX_CHAT_MESSAGES } from "@/types/tasks";

// What GET /api/projects/[projectId]/specs returns per document; the content comes from the download route.
interface SpecSummary {
  id: string;
  // A technical spec, or decision records (spec 58).
  kind: SpecKind;
  filename: string;
  createdAt: string;
  // The newest Confluence page it was published to (spec 61).
  publishedUrl: string | null;
}

const SPEC_MESSAGES: DocumentRunMessages = {
  startFailed: "Couldn't start spec generation. Try again.",
  runFailed: "Couldn't generate the spec. Try again.",
  lostTrack: "Lost track of the spec run. The spec will appear here when it's ready.",
};

const ADR_MESSAGES: DocumentRunMessages = {
  startFailed: "Couldn't start generating decision records. Try again.",
  runFailed: "Couldn't generate the decision records. Try again.",
  lostTrack: "Lost track of the decision records run. They will appear here when they're ready.",
};

type KindFilter = "ALL" | SpecKind;

// The filter chips above the list, and the empty state each one shows.
const FILTERS: { value: KindFilter; label: string; emptyTitle: string; emptyText: string }[] = [
  {
    value: "ALL",
    label: "All",
    emptyTitle: "No specs or decision records yet",
    emptyText: "Generated specs and decision records for this project will appear here.",
  },
  {
    value: "SPEC",
    label: "Specs",
    emptyTitle: "No specs yet",
    emptyText: "Generated specs for this project will appear here.",
  },
  {
    value: "ADR",
    label: "Decision records",
    emptyTitle: "No decision records yet.",
    emptyText: "Generated decision records for this project will appear here.",
  },
];

const KIND_BADGES: Record<SpecKind, { label: string; className: string }> = {
  SPEC: { label: "Spec", className: "border-ai/40 text-ai-text" },
  ADR: { label: "ADR", className: "border-brand/40 text-brand" },
};

type Loaded<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

// Date and time in the viewer's locale, e.g. "Nov 9, 2026, 3:42 PM".
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

// The last space key used, remembered per browser.
const SPACE_KEY_STORAGE = "mindmesh:confluence-space-key";

function downloadUrl(projectId: string, specId: string) {
  return `/api/projects/${projectId}/specs/${specId}/download`;
}

interface SpecsTabProps {
  projectId: string;
  // The tab is kept mounted; the list reloads each time it becomes visible.
  isActive: boolean;
  // The room's chat, sent along as context for the spec.
  chatMessages: ChatEntry[];
  getCanvas: () => CanvasSnapshot | null;
}

export function SpecsTab({ projectId, isActive, chatMessages, getCanvas }: SpecsTabProps) {
  const [specs, setSpecs] = useState<Loaded<SpecSummary[]>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<SpecSummary | null>(null);
  const [filter, setFilter] = useState<KindFilter>("ALL");
  // Whether the active workspace has an Atlassian connection, so "Publish to Confluence" is offered.
  const [canPublish, setCanPublish] = useState(false);
  // The canvas guards' message; each run's own messages come from its hook.
  const [guardNotice, setGuardNotice] = useState<string | null>(null);
  // Which button was used last, so its run's notice is the one shown.
  const [lastKind, setLastKind] = useState<SpecKind>("SPEC");
  // The decision log the AI architect recorded (spec 72).
  const [isDecisionsOpen, setIsDecisionsOpen] = useState(false);
  // A finished run reloads the list.
  const reload = () => setAttempt((n) => n + 1);
  const specRun = useDocumentRun({
    triggerRoute: "/api/ai/spec",
    messages: SPEC_MESSAGES,
    onSuccess: reload,
  });
  const adrRun = useDocumentRun({
    triggerRoute: "/api/ai/adr",
    messages: ADR_MESSAGES,
    onSuccess: reload,
  });
  // One run at a time: both buttons wait while either is active.
  const isGenerating = specRun.isRunning || adrRun.isRunning;
  const notice = guardNotice ?? (lastKind === "SPEC" ? specRun.notice : adrRun.notice);

  // Sends the live canvas and the chat to POST /api/ai/spec or /api/ai/adr (the same body), then
  // follows the run.
  function generate(kind: SpecKind) {
    if (isGenerating) return;
    setLastKind(kind);
    const canvas = getCanvas();
    if (!canvas) return setGuardNotice("The canvas is still loading. Try again in a moment.");
    if (canvas.nodes.length === 0) return setGuardNotice("Add something to the canvas first.");

    setGuardNotice(null);
    void (kind === "SPEC" ? specRun : adrRun).start({
      roomId: projectId,
      chatHistory: chatMessages.slice(-SPEC_MAX_CHAT_MESSAGES),
      nodes: canvas.nodes,
      edges: canvas.edges,
    });
  }

  useEffect(() => {
    if (!isActive) return;
    const controller = new AbortController();
    fetch(`/api/projects/${projectId}/specs`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Spec list failed with status ${res.status}`);
        return res.json() as Promise<{ specs: SpecSummary[] }>;
      })
      .then(({ specs }) => setSpecs({ status: "ready", data: specs }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setSpecs({ status: "error" });
      });
    return () => controller.abort();
  }, [projectId, attempt, isActive]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/integrations", { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ provider: string }[]>) : []))
      .then((items) => setCanPublish(items.some((item) => item.provider === "ATLASSIAN")))
      .catch(() => {
        // Without the list the button stays hidden; the publish route checks the connection anyway.
      });
    return () => controller.abort();
  }, []);

  // A publish updates the row without reloading the list.
  function markPublished(specId: string, url: string) {
    setSpecs((current) =>
      current.status === "ready"
        ? {
            status: "ready",
            data: current.data.map((spec) => (spec.id === specId ? { ...spec, publishedUrl: url } : spec)),
          }
        : current
    );
  }

  const activeFilter = FILTERS.find((option) => option.value === filter) ?? FILTERS[0];
  const visible =
    specs.status === "ready" ? specs.data.filter((spec) => filter === "ALL" || spec.kind === filter) : [];

  function retry() {
    setSpecs({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Follows each document run; see components/editor/run-poller.tsx. */}
      {specRun.activeRun && <RunPoller runId={specRun.activeRun.runId} onComplete={specRun.finishRun} />}
      {adrRun.activeRun && <RunPoller runId={adrRun.activeRun.runId} onComplete={adrRun.finishRun} />}
      <div className="flex flex-col gap-2 p-4 pb-3">
        <Button
          onClick={() => generate("SPEC")}
          disabled={isGenerating}
          aria-busy={specRun.isRunning}
          className="w-full rounded-xl bg-ai text-white hover:bg-ai/90"
        >
          {specRun.isRunning ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {specRun.isRunning ? "Generating spec…" : "Generate Spec"}
        </Button>
        <Button
          variant="outline"
          onClick={() => generate("ADR")}
          disabled={isGenerating}
          aria-busy={adrRun.isRunning}
          className="w-full rounded-xl"
        >
          {adrRun.isRunning ? <Loader2 className="animate-spin" /> : <ListChecks />}
          {adrRun.isRunning ? "Generating decision records…" : "Generate decision records"}
        </Button>
        <Button
          variant="ghost"
          aria-haspopup="dialog"
          onClick={() => setIsDecisionsOpen(true)}
          className="w-full rounded-xl text-copy-secondary"
        >
          <Lightbulb />
          Design decisions
        </Button>
        {notice && (
          <p role="status" className="text-xs text-copy-muted">
            {notice}
          </p>
        )}
      </div>

      {specs.status === "ready" && (
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5 px-4 pb-3">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ai/60",
                filter === option.value
                  ? "border-ai/50 bg-ai/15 text-copy-primary"
                  : "border-surface-border text-copy-muted hover:bg-subtle hover:text-copy-secondary"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        {specs.status === "loading" && (
          <p role="status" className="flex items-center justify-center gap-2 p-6 text-xs text-copy-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading specs…
          </p>
        )}
        {specs.status === "error" && (
          <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-xs text-copy-muted">Couldn&apos;t load the specs.</p>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={retry}>
              Try again
            </Button>
          </div>
        )}
        {specs.status === "ready" && visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-subtle">
              <FileText className="h-6 w-6 text-ai-text" />
            </span>
            <p className="text-sm font-medium text-copy-primary">{activeFilter.emptyTitle}</p>
            <p className="text-xs text-copy-muted">{activeFilter.emptyText}</p>
          </div>
        )}
        {specs.status === "ready" && visible.length > 0 && (
          <ul className="flex flex-col gap-2 px-4 pb-4">
            {visible.map((spec) => (
              <li
                key={spec.id}
                className="flex items-center gap-1 rounded-2xl border border-surface-border bg-elevated pr-2 transition-colors hover:bg-subtle"
              >
                <button
                  type="button"
                  onClick={() => setSelected(spec)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 text-left focus-visible:ring-2 focus-visible:ring-ai/60 focus-visible:outline-none"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-subtle">
                    <FileText className="h-4 w-4 text-ai-text" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-copy-primary">{spec.filename}</span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-1.5 text-[10px] leading-4 font-medium",
                          KIND_BADGES[spec.kind].className
                        )}
                      >
                        {KIND_BADGES[spec.kind].label}
                      </span>
                      <time dateTime={spec.createdAt} className="truncate text-xs text-copy-muted">
                        {DATE_TIME_FORMAT.format(new Date(spec.createdAt))}
                      </time>
                    </span>
                  </span>
                </button>
                {spec.publishedUrl && (
                  <a
                    href={spec.publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${spec.filename} in Confluence`}
                    title="Open in Confluence"
                    className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                  >
                    <ExternalLink />
                  </a>
                )}
                <a
                  href={downloadUrl(projectId, spec.id)}
                  download={spec.filename}
                  aria-label={`Download ${spec.filename}`}
                  title={spec.kind === "ADR" ? "Download decision records" : "Download spec"}
                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                >
                  <Download />
                </a>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      {isDecisionsOpen && (
        <DesignDecisionsDialog projectId={projectId} getCanvas={getCanvas} onClose={() => setIsDecisionsOpen(false)} />
      )}
      {selected && (
        <SpecPreviewDialog
          key={selected.id}
          projectId={projectId}
          spec={selected}
          canPublish={canPublish}
          onPublished={(url) => markPublished(selected.id, url)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

interface SpecPreviewDialogProps {
  projectId: string;
  spec: SpecSummary;
  canPublish: boolean;
  onPublished: (url: string) => void;
  onClose: () => void;
}

// The Markdown is fetched through the download route on open and dropped on close.
function SpecPreviewDialog({ projectId, spec, canPublish, onPublished, onClose }: SpecPreviewDialogProps) {
  const [content, setContent] = useState<Loaded<string>>({ status: "loading" });
  const [showPublish, setShowPublish] = useState(false);
  const url = downloadUrl(projectId, spec.id);

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Spec download failed with status ${res.status}`);
        return res.text();
      })
      .then((text) => setContent({ status: "ready", data: text }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setContent({ status: "error" });
      });
    return () => controller.abort();
  }, [url]);

  return (
    <EditorDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={spec.filename}
      description={`Generated ${DATE_TIME_FORMAT.format(new Date(spec.createdAt))}`}
      className="sm:max-w-3xl"
      footer={
        <>
          <Button variant="outline" className="rounded-xl" onClick={onClose}>
            Close
          </Button>
          {canPublish && !showPublish && (
            <Button variant="outline" className="rounded-xl" onClick={() => setShowPublish(true)}>
              <Send />
              Publish to Confluence
            </Button>
          )}
          <a
            href={url}
            download={spec.filename}
            className={cn(buttonVariants(), "rounded-xl bg-ai text-white hover:bg-ai/90")}
          >
            <Download />
            Download
          </a>
        </>
      }
    >
      {showPublish && <ConfluencePublishForm projectId={projectId} specId={spec.id} onPublished={onPublished} />}
      <ScrollArea className="-mx-6 h-[60vh] border-y border-surface-border bg-surface">
        <div className="px-6 py-5">
          {content.status === "loading" && (
            <p role="status" className="flex items-center gap-2 text-sm text-copy-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading spec…
            </p>
          )}
          {content.status === "error" && (
            <p role="alert" className="text-sm text-error">
              Couldn&apos;t load this spec. Try downloading it instead.
            </p>
          )}
          {content.status === "ready" && (
            <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
              {content.data}
            </Markdown>
          )}
        </div>
      </ScrollArea>
    </EditorDialog>
  );
}

function readSpaceKey() {
  try {
    return localStorage.getItem(SPACE_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

function rememberSpaceKey(key: string) {
  try {
    localStorage.setItem(SPACE_KEY_STORAGE, key);
  } catch {
    // Storage can be blocked; the key just isn't remembered.
  }
}

interface ConfluencePublishFormProps {
  projectId: string;
  specId: string;
  onPublished: (url: string) => void;
}

// Space key and optional parent page; each publish creates a new page.
function ConfluencePublishForm({ projectId, specId, onPublished }: ConfluencePublishFormProps) {
  const [spaceKey, setSpaceKey] = useState(readSpaceKey);
  const [parentPageId, setParentPageId] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (publishing) return;
    const key = spaceKey.trim();
    const parent = parentPageId.trim();
    setPublishing(true);
    setError(null);
    setPublishedUrl(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/specs/${specId}/publish/confluence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spaceKey: key, ...(parent ? { parentPageId: parent } : {}) }),
      });
      const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !body?.url) {
        setError(body?.error ?? "Couldn't publish to Confluence. Try again.");
        return;
      }
      rememberSpaceKey(key);
      setPublishedUrl(body.url);
      onPublished(body.url);
    } catch {
      setError("Couldn't publish to Confluence. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <form
      onSubmit={publish}
      aria-label="Publish to Confluence"
      className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-elevated p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-copy-secondary">
          Space key
          <Input
            value={spaceKey}
            onChange={(e) => setSpaceKey(e.target.value)}
            placeholder="e.g. ENG"
            required
            autoComplete="off"
            className="rounded-xl"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-copy-secondary">
          Parent page ID (optional)
          <Input
            value={parentPageId}
            onChange={(e) => setParentPageId(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className="rounded-xl"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={publishing || !spaceKey.trim()} className="rounded-xl">
          {publishing ? <Loader2 className="animate-spin" /> : <Send />}
          {publishing ? "Publishing…" : "Publish"}
        </Button>
        {publishedUrl && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            Published
            <a
              href={publishedUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-brand underline underline-offset-2"
            >
              Open page
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

// react-markdown passes its AST node as a prop; it's dropped here so it never reaches the DOM.
function styled(tag: string, className: string, extra?: Record<string, string>) {
  return function MarkdownElement({ node, ...props }: ExtraProps & object) {
    void node;
    return createElement(tag, { ...props, ...extra, className });
  };
}

// No typography plugin is installed, so each element gets the project's tokens here.
const MARKDOWN_COMPONENTS: Components = {
  h1: styled("h1", "mb-4 text-xl font-semibold text-copy-primary"),
  h2: styled("h2", "mt-6 mb-3 border-b border-surface-border pb-1 text-base font-semibold text-copy-primary"),
  h3: styled("h3", "mt-4 mb-2 text-sm font-semibold text-copy-primary"),
  h4: styled("h4", "mt-3 mb-1 text-sm font-medium text-copy-secondary"),
  p: styled("p", "my-2 text-sm leading-6 text-copy-secondary"),
  ul: styled("ul", "my-2 list-disc space-y-1 pl-5 text-sm leading-6 text-copy-secondary"),
  ol: styled("ol", "my-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-copy-secondary"),
  strong: styled("strong", "font-semibold text-copy-primary"),
  a: styled("a", "text-brand underline underline-offset-2", { target: "_blank", rel: "noreferrer" }),
  blockquote: styled("blockquote", "my-3 border-l-2 border-ai pl-3 text-sm text-copy-muted"),
  hr: styled("hr", "my-5 border-surface-border"),
  code: styled("code", "rounded bg-subtle px-1 py-0.5 font-mono text-xs text-copy-primary"),
  pre: styled("pre", "my-3 overflow-x-auto rounded-xl bg-subtle p-3 text-xs [&_code]:bg-transparent [&_code]:p-0"),
  table: function MarkdownTable({ node, ...props }) {
    void node;
    // Wide tables scroll on their own instead of widening the dialog.
    return (
      <div className="my-3 overflow-x-auto">
        <table {...props} className="w-full border-collapse text-left text-xs text-copy-secondary" />
      </div>
    );
  },
  th: styled("th", "border border-surface-border bg-subtle px-2 py-1.5 font-medium text-copy-primary"),
  td: styled("td", "border border-surface-border px-2 py-1.5 align-top"),
};
