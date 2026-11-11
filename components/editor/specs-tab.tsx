"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { Download, FileText, Loader2, Sparkles } from "lucide-react";
import { createElement, useEffect, useRef, useState } from "react";
import Markdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";

import { EditorDialog } from "@/components/editor/editor-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatEntry } from "@/hooks/use-ai-chat";
import type { CanvasSnapshot } from "@/lib/canvas-snapshot";
import { postJson } from "@/lib/post-json";
import { cn } from "@/lib/utils";
import type { generateSpec } from "@/trigger/generate-spec";
import { SPEC_MAX_CHAT_MESSAGES } from "@/types/tasks";

// What GET /api/projects/[projectId]/specs returns per spec; the content comes from the download route.
interface SpecSummary {
  id: string;
  filename: string;
  createdAt: string;
}

type Loaded<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

// Date and time in the viewer's locale, e.g. "Nov 9, 2026, 3:42 PM".
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

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

// The run this browser started, and the token that lets it read only that run.
interface ActiveRun {
  runId: string;
  publicToken: string;
}

export function SpecsTab({ projectId, isActive, chatMessages, getCanvas }: SpecsTabProps) {
  const [specs, setSpecs] = useState<Loaded<SpecSummary[]>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<SpecSummary | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // onComplete can fire again when the subscription stops; handle each run once.
  const finishedRunId = useRef<string | null>(null);
  const isGenerating = isStarting || activeRun !== null;

  useRealtimeRun<typeof generateSpec>(activeRun?.runId, {
    accessToken: activeRun?.publicToken,
    enabled: activeRun !== null,
    // The output is the whole spec; the list only needs to know the run finished.
    skipColumns: ["payload", "output"],
    onComplete: (run, err) => {
      if (run && finishedRunId.current === run.id) return;
      if (run) finishedRunId.current = run.id;
      if (run?.isSuccess) {
        setNotice(null);
        setAttempt((n) => n + 1);
      } else if (run?.isCompleted) {
        setNotice("Couldn't generate the spec. Try again.");
      } else if (err) {
        setNotice("Lost track of the spec run. The spec will appear here when it's ready.");
      } else {
        return;
      }
      setActiveRun(null);
    },
  });

  // Sends the live canvas and the chat to POST /api/ai/spec, then follows the run.
  async function generate() {
    if (isGenerating) return;
    const canvas = getCanvas();
    if (!canvas) return setNotice("The canvas is still loading. Try again in a moment.");
    if (canvas.nodes.length === 0) return setNotice("Add something to the canvas first.");

    setNotice(null);
    setIsStarting(true);
    let runId: string;
    try {
      ({ runId } = await postJson<{ runId: string }>("/api/ai/spec", {
        roomId: projectId,
        chatHistory: chatMessages.slice(-SPEC_MAX_CHAT_MESSAGES),
        nodes: canvas.nodes,
        edges: canvas.edges,
      }));
    } catch (err) {
      console.error(err);
      setNotice("Couldn't start spec generation. Try again.");
      setIsStarting(false);
      return;
    }
    try {
      const { token } = await postJson<{ token: string }>("/api/ai/spec/token", { runId });
      setActiveRun({ runId, publicToken: token });
    } catch (err) {
      console.error(err);
      setNotice("The spec is being generated, but its progress can't be shown. It will appear here when it's ready.");
    } finally {
      setIsStarting(false);
    }
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

  function retry() {
    setSpecs({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 p-4 pb-3">
        <Button
          onClick={generate}
          disabled={isGenerating}
          aria-busy={isGenerating}
          className="w-full rounded-xl bg-ai text-white hover:bg-ai/90"
        >
          {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {isGenerating ? "Generating spec…" : "Generate Spec"}
        </Button>
        {notice && (
          <p role="status" className="text-xs text-copy-muted">
            {notice}
          </p>
        )}
      </div>

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
        {specs.status === "ready" && specs.data.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-subtle">
              <FileText className="h-6 w-6 text-ai-text" />
            </span>
            <p className="text-sm font-medium text-copy-primary">No specs yet</p>
            <p className="text-xs text-copy-muted">Generated specs for this project will appear here.</p>
          </div>
        )}
        {specs.status === "ready" && specs.data.length > 0 && (
          <ul className="flex flex-col gap-2 px-4 pb-4">
            {specs.data.map((spec) => (
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
                    <time dateTime={spec.createdAt} className="block text-xs text-copy-muted">
                      {DATE_TIME_FORMAT.format(new Date(spec.createdAt))}
                    </time>
                  </span>
                </button>
                <a
                  href={downloadUrl(projectId, spec.id)}
                  download={spec.filename}
                  aria-label={`Download ${spec.filename}`}
                  title="Download spec"
                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                >
                  <Download />
                </a>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      {selected && (
        <SpecPreviewDialog
          key={selected.id}
          projectId={projectId}
          spec={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

interface SpecPreviewDialogProps {
  projectId: string;
  spec: SpecSummary;
  onClose: () => void;
}

// The Markdown is fetched through the download route on open and dropped on close.
function SpecPreviewDialog({ projectId, spec, onClose }: SpecPreviewDialogProps) {
  const [content, setContent] = useState<Loaded<string>>({ status: "loading" });
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
