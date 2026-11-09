import type { TaskStatusMessage } from "@/types/tasks";

// How the design agent appears in presence; the color is --accent-ai-text from ui-context.md.
export const AI_AGENT = {
  id: "ghost-ai",
  info: { name: "Ghost AI", avatar: "", color: "#8b82ff" },
} as const;

// The parts of a Trigger.dev realtime run that decide the final chat message.
interface FinishedRun {
  isCompleted: boolean;
  isSuccess: boolean;
  output?: { applied: number; skipped: number };
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
      if (latest?.status === "completed" && latest.text) return latest.text;
      const applied = run.output?.applied ?? 0;
      return `Done. Applied ${applied} ${applied === 1 ? "change" : "changes"} to the canvas.`;
    }
    if (latest?.status === "failed" && latest.text) return latest.text;
    return "The design run didn't finish. Any changes made before it stopped are still on the canvas. Try again.";
  }
  if (error) {
    return "Lost track of the design run. Its changes will still appear on the canvas when it finishes.";
  }
  return null;
}
