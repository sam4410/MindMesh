import { Liveblocks } from "@liveblocks/node";

let client: Liveblocks | undefined;

// Created on first use so builds and routes that never touch Liveblocks don't need the secret.
export function getLiveblocks() {
  if (!client) {
    const secret = process.env.LIVEBLOCKS_SECRET_KEY;
    if (!secret) throw new Error("LIVEBLOCKS_SECRET_KEY is not set");
    client = new Liveblocks({ secret });
  }
  return client;
}

export { getUserColor } from "@/lib/user-color";
