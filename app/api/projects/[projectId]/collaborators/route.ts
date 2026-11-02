import { clerkClient } from "@clerk/nextjs/server";

import { Prisma } from "@/app/generated/prisma/client";
import { getAccessibleProject, getCurrentIdentity, requireOwner } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

type Context = RouteContext<"/api/projects/[projectId]/collaborators">;

const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Profile {
  name: string | null;
  imageUrl: string | null;
}

// Looks up Clerk users by email; emails without a Clerk account are simply absent from the map.
async function loadProfiles(emails: string[]) {
  const profiles = new Map<string, Profile>();
  if (emails.length === 0) return profiles;
  try {
    const client = await clerkClient();
    // shortcut: one page of up to 100 users, enough until projects get more collaborators than that.
    const { data } = await client.users.getUserList({ emailAddress: emails, limit: 100 });
    for (const user of data) {
      const profile = { name: user.fullName ?? user.username, imageUrl: user.imageUrl };
      for (const { emailAddress } of user.emailAddresses) {
        profiles.set(emailAddress.toLowerCase(), profile);
      }
    }
  } catch (err) {
    // The list still works without names and avatars, so a Clerk outage only degrades it.
    console.error("Failed to load collaborator profiles from Clerk", err);
  }
  return profiles;
}

// Owners and collaborators can both view the list.
export async function GET(_req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const collaborators = await prisma.projectCollaborator.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  const profiles = await loadProfiles(collaborators.map((c) => c.email));

  return Response.json(
    collaborators.map((c) => ({
      ...c,
      name: profiles.get(c.email)?.name ?? null,
      imageUrl: profiles.get(c.email)?.imageUrl ?? null,
    }))
  );
}

export async function POST(req: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  const denied = await requireOwner(projectId);
  if (denied) return denied;

  const body: unknown = await req.json().catch(() => null);
  const rawEmail = (body as { email?: unknown } | null)?.email;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  try {
    const collaborator = await prisma.projectCollaborator.create({
      data: { projectId, email },
      select: { id: true, email: true },
    });
    return Response.json(collaborator, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return Response.json({ error: "This person is already a collaborator" }, { status: 409 });
    }
    throw err;
  }
}
