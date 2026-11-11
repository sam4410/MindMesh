import { auth } from "@trigger.dev/sdk";

import { getCurrentIdentity } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

// Issues a token that can only read this one run, and only to the user who started it.
export async function POST(req: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: { runId?: unknown } | null = await req.json().catch(() => null);
  const runId = body?.runId;
  if (typeof runId !== "string" || !runId) {
    return Response.json({ error: "runId is required" }, { status: 400 });
  }

  const taskRun = await prisma.taskRun.findFirst({
    where: { runId, userId: identity.userId },
    select: { id: true },
  });
  if (!taskRun) return Response.json({ error: "Run not found" }, { status: 404 });

  try {
    const token = await auth.createPublicToken({ scopes: { read: { runs: [runId] } } });
    return Response.json({ token });
  } catch (err) {
    console.error("Failed to create run token", err);
    return Response.json({ error: "Couldn't create the token" }, { status: 502 });
  }
}
