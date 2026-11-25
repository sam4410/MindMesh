import { CHAT_MESSAGE_MAX_LENGTH, type TaskStatusMessage } from "@/types/tasks";

// How the design agent appears in presence; the color is --accent-ai-text from ui-context.md.
export const AI_AGENT = {
  // Kept from the old product name: earlier AI chat messages are stored under this ID.
  id: "ghost-ai",
  info: { name: "MindMesh", avatar: "", color: "#8b82ff" },
} as const;

// How often the browser checks a run it started (components/editor/run-poller.tsx).
export const RUN_POLL_INTERVAL_MS = 2_000;

// What GET /api/ai/runs/[runId] returns (lib/task-runs.ts).
export interface RunState<TOutput = unknown> {
  id: string;
  isCompleted: boolean;
  isSuccess: boolean;
  output?: TOutput;
}

// The parts of a finished design run that decide the final chat message.
export interface FinishedRun {
  isCompleted: boolean;
  isSuccess: boolean;
  // sources: documents the research step used (spec 70); missing for runs without research.
  output?: { applied: number; skipped: number; sources?: { title: string; url: string }[] };
}

// Appends "Sources:" with one "- Title (URL)" line each, dropping sources from the end so the
// message stays within the chat limit.
export function withSources(text: string, sources: readonly { title: string; url: string }[] = []) {
  let lines = sources.map((source) => `- ${source.title} (${source.url})`);
  const build = () => (lines.length ? `${text}\n\nSources:\n${lines.join("\n")}` : text);
  while (lines.length && build().length > CHAT_MESSAGE_MAX_LENGTH) lines = lines.slice(0, -1);
  return build().slice(0, CHAT_MESSAGE_MAX_LENGTH);
}

/**
 * The AI's final ai-chat message for a design run, or null when there's nothing to say yet
 * (the subscription stopped without the run finishing, e.g. the sidebar unmounted).
 * `latest` is the newest ai-status-feed message: when it's this run's own summary, it's reused.
 */
export function designRunMessage(
  run: FinishedRun | undefined,
  error: Error | undefined,
  latest: TaskStatusMessage | null
): string | null {
  if (run?.isCompleted) {
    if (run.isSuccess) {
      const applied = run.output?.applied ?? 0;
      const summary =
        latest?.status === "completed" && latest.text
          ? latest.text
          : `Done. Applied ${applied} ${applied === 1 ? "change" : "changes"} to the canvas.`;
      return withSources(summary, run.output?.sources);
    }
    if (latest?.status === "failed" && latest.text) return latest.text;
    return "The design run didn't finish. Any changes made before it stopped are still on the canvas. Try again.";
  }
  if (error) {
    return "Lost track of the design run. Its changes will still appear on the canvas when it finishes.";
  }
  return null;
}
