import { auth } from "@clerk/nextjs/server";

import { Prisma } from "@/app/generated/prisma/client";
import { getCurrentIdentity } from "@/lib/project-access";
import { readProjectInput } from "@/lib/project-input";
import { getProjectsForUser } from "@/lib/projects";
import { prisma } from "@/lib/prisma";

// The same "My Projects" list as the sidebar, scoped to the active workspace.
export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { owned } = await getProjectsForUser(identity);
  return Response.json(owned);
}

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const input = await readProjectInput(req);
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });

  try {
    // A client-supplied id keeps the project ID equal to its Liveblocks room ID; otherwise the schema's cuid applies.
    const project = await prisma.project.create({
      // Created in the active workspace: the active organization, or personal (null).
      data: { id: input.id, ownerId: userId, organizationId: orgId ?? null, name: input.name ?? "Untitled Project" },
    });
    return Response.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "A project with this ID already exists" }, { status: 409 });
    }
    throw error;
  }
}
