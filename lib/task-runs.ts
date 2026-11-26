import { randomUUID } from "node:crypto";

import { NonRetriableError } from "inngest";
import type { z } from "zod";

import type { Prisma } from "@/app/generated/prisma/client";
import {
  adrRequested,
  costRequested,
  designRequested,
  inngest,
  reviewRequested,
  specRequested,
} from "@/inngest/client";
import type { RunState } from "@/lib/ai-status";
import { prisma } from "@/lib/prisma";

// A run still RUNNING after this long is reported as failed: its function was lost (or it was a
// Trigger.dev run from before the move to Inngest).
const STALE_AFTER_MS = 15 * 60_000;

// Records the run with its payload, then sends the event that starts it. Returns the run ID.
// The row comes first, so a fast function always finds its input.
export async function startTaskRun(
  event:
    | typeof designRequested
    | typeof specRequested
    | typeof adrRequested
    | typeof reviewRequested
    | typeof costRequested,
  { projectId, userId, input }: { projectId: string; userId: string; input: Prisma.InputJsonValue }
) {
  const runId = randomUUID();
  await prisma.taskRun.create({ data: { runId, projectId, userId, input } });
  try {
    await inngest.send(event.create({ runId }));
  } catch (err) {
    // Nothing will ever run it, so don't leave a row that looks like it's running.
    await prisma.taskRun.delete({ where: { runId } }).catch(() => {});
    throw err;
  }
  return runId;
}

// The run's payload, validated again: the row's JSON isn't typed.
export async function loadRunInput<T extends z.ZodType>(runId: string, schema: T): Promise<z.output<T>> {
  const row = await prisma.taskRun.findUnique({ where: { runId }, select: { input: true } });
  if (!row) throw new NonRetriableError(`Run ${runId} not found`);
  const parsed = schema.safeParse(row.input);
  if (!parsed.success) throw new NonRetriableError(`Run ${runId} has an invalid payload`);
  return parsed.data;
}

export async function completeTaskRun(runId: string, output?: Prisma.InputJsonValue) {
  await prisma.taskRun.update({ where: { runId }, data: { status: "COMPLETED", output } });
}

export async function failTaskRun(runId: string) {
  // updateMany, so a run whose row is already gone (project deleted) doesn't throw.
  await prisma.taskRun.updateMany({ where: { runId }, data: { status: "FAILED" } });
}

// The run as its starter sees it, or null when it isn't theirs.
export async function getRunState(runId: string, userId: string): Promise<RunState | null> {
  const run = await prisma.taskRun.findFirst({
    where: { runId, userId },
    select: { status: true, output: true, createdAt: true },
  });
  if (!run) return null;
  const stale = run.status === "RUNNING" && Date.now() - run.createdAt.getTime() > STALE_AFTER_MS;
  return {
    id: runId,
    isCompleted: run.status !== "RUNNING" || stale,
    isSuccess: run.status === "COMPLETED",
    ...(run.output !== null && { output: run.output }),
  };
}
