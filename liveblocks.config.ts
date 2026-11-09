// Global Liveblocks types, picked up by @liveblocks/client, /react and /node.
declare global {
  interface Liveblocks {
    Presence: {
      // Canvas coordinates; null while the pointer is outside the canvas.
      cursor: { x: number; y: number } | null;
      // True while this participant is generating; the design agent sets it on its own presence.
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
