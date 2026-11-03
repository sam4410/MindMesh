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

// Cursor colors, taken from the canvas node text colors in ui-context.md plus the brand cyan.
const CURSOR_COLORS = [
  "#52A8FF",
  "#BF7AF0",
  "#FF990A",
  "#FF6166",
  "#F75F8F",
  "#62C073",
  "#0AC7B4",
  "#00C8D4",
] as const;

// Same user ID → same color on every device and session (FNV-1a hash).
export function getUserColor(userId: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return CURSOR_COLORS[(hash >>> 0) % CURSOR_COLORS.length];
}
