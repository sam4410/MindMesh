// Global Liveblocks types, picked up by @liveblocks/client, /react and /node.
declare global {
  interface Liveblocks {
    Presence: {
      // Canvas coordinates; null while the pointer is outside the canvas.
      cursor: { x: number; y: number } | null;
      isThinking: boolean;
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
