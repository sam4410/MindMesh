import { auth, clerkClient } from "@clerk/nextjs/server";

// resolveUsers in collaborative-canvas.tsx asks in chunks of this size (USER_IDS_PER_REQUEST).
const MAX_USER_IDS = 50;

// GET /api/users?ids=a,b,c: names and avatars for comment threads (spec 54). Only the name and
// image are returned, never the email.
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return Response.json({ error: "ids is required" }, { status: 400 });
  if (ids.length > MAX_USER_IDS) {
    return Response.json({ error: `At most ${MAX_USER_IDS} ids` }, { status: 400 });
  }

  const client = await clerkClient();
  // Clerk's default page size is 10, so ask for all of them.
  const { data } = await client.users.getUserList({ userId: ids, limit: ids.length });
  return Response.json(
    data.map((user) => ({
      id: user.id,
      name: user.fullName ?? user.username ?? "Anonymous",
      avatar: user.imageUrl,
    }))
  );
}
