// Global Liveblocks types, picked up by @liveblocks/client, /react and /node.
declare global {
  interface Liveblocks {
    Presence: {
      // Canvas coordinates; null while the pointer is outside the canvas.
      cursor: { x: number; y: number } | null;
      // True while this user is waiting on an AI generation.
      thinking: boolean;
    };
    UserMeta: {
      id: string;
      info: {
        name: string;
        avatar: string;
        color: string;
      };
    };
  }
}

export {};
