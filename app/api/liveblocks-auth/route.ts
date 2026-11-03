import { getLiveblocks, getUserColor } from "@/lib/liveblocks";
import { getAccessibleProject, getCurrentIdentity } from "@/lib/project-access";

// Called by the Liveblocks client with { room }; the room ID is the project ID.
export async function POST(req: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await req.json().catch(() => null);
  const room = (body as { room?: unknown } | null)?.room;
  if (typeof room !== "string" || room === "") {
    return Response.json({ error: "room is required" }, { status: 400 });
  }

  const project = await getAccessibleProject(room, identity);
  if (!project) return Response.json({ error: "Forbidden" }, { status: 403 });

  const liveblocks = getLiveblocks();
  // Private room: access comes only from tokens issued here after the project check.
  await liveblocks.getOrCreateRoom(project.id, { defaultAccesses: [] });

  const session = liveblocks.prepareSession(identity.userId, {
    userInfo: {
      name: identity.name,
      avatar: identity.imageUrl,
      color: getUserColor(identity.userId),
    },
  });
  session.allow(project.id, session.FULL_ACCESS);

  const { status, body: token } = await session.authorize();
  return new Response(token, { status, headers: { "content-type": "application/json" } });
}
