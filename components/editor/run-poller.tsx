"use client";

import { useEffect, useRef } from "react";

import { RUN_POLL_INTERVAL_MS, type RunState } from "@/lib/ai-status";

// Follows a background AI run started by this browser: checks GET /api/ai/runs/[runId] every
// RUN_POLL_INTERVAL_MS and calls onComplete once, when the run finishes or can't be found.
// Mount it only while the run is active.
export function RunPoller<TOutput>({
  runId,
  onComplete,
}: {
  runId: string;
  onComplete: (run: RunState<TOutput> | undefined, err?: Error) => void;
}) {
  // Changes identity every render; the interval reads the newest one without restarting.
  const latest = useRef(onComplete);
  useEffect(() => {
    latest.current = onComplete;
  });

  useEffect(() => {
    let done = false;
    const finish = (run: RunState<TOutput> | undefined, err?: Error) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      latest.current(run, err);
    };
    const timer = setInterval(() => {
      fetch(`/api/ai/runs/${encodeURIComponent(runId)}`, { cache: "no-store" })
        .then(async (res) => {
          if (res.status === 404) return finish(undefined, new Error("Run not found"));
          // Anything else (a deploy, a network blip) is retried on the next tick.
          if (!res.ok) return;
          const run = (await res.json()) as RunState<TOutput>;
          if (run.isCompleted) finish(run);
        })
        .catch(() => {});
    }, RUN_POLL_INTERVAL_MS);
    return () => {
      done = true;
      clearInterval(timer);
    };
  }, [runId]);

  return null;
}
