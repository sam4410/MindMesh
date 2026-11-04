import { auth } from "@clerk/nextjs/server";

import { Prisma } from "@/app/generated/prisma/client";
import { readProjectInput } from "@/lib/project-input";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(projects);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const input = await readProjectInput(req);
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });

  try {
    // A client-supplied id keeps the project ID equal to its Liveblocks room ID; otherwise the schema's cuid applies.
    const project = await prisma.project.create({
      data: { id: input.id, ownerId: userId, name: input.name ?? "Untitled Project" },
    });
    return Response.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "A project with this ID already exists" }, { status: 409 });
    }
    throw error;
  }
}
