"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import { shallow, useOthersMapped } from "@liveblocks/react";
import { Panel } from "@xyflow/react";

const MAX_AVATARS = 5;
// Collaborator avatars and the Clerk UserButton share this size so the group lines up.
const AVATAR_SIZE = "h-8 w-8";

interface Collaborator {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
}

// Rendered inside <ReactFlow>, so it only exists in the room view; the shared navbar is untouched.
export function PresenceAvatars() {
  const { userId } = useAuth();
  const others = useOthersMapped(
    (other) => ({ id: other.id, ...other.info }),
    shallow
  );

  // One avatar per person: the current user and their other tabs are excluded,
  // and a collaborator with several tabs open is shown once.
  const collaborators = [
    ...new Map(
      others
        .map(([, user]) => user as Collaborator)
        .filter((user) => user.id && user.id !== userId)
        .map((user) => [user.id, user])
    ).values(),
  ];
  const visible = collaborators.slice(0, MAX_AVATARS);
  const overflow = collaborators.length - visible.length;

  return (
    <Panel
      position="top-right"
      aria-label="People in this canvas"
      className="flex items-center gap-2 rounded-full border border-surface-border bg-surface/90 p-1.5 backdrop-blur"
    >
      {collaborators.length > 0 && (
        <>
          <ul className="flex items-center -space-x-1.5">
            {visible.map((user) => (
              <li key={user.id} title={user.name}>
                <CollaboratorAvatar user={user} />
              </li>
            ))}
            {overflow > 0 && (
              <li
                title={`${overflow} more`}
                className={`${AVATAR_SIZE} flex items-center justify-center rounded-full bg-subtle text-xs font-medium text-copy-secondary ring-2 ring-surface-border-subtle`}
              >
                +{overflow}
              </li>
            )}
          </ul>
          <div aria-hidden className="h-5 w-px bg-surface-border" />
        </>
      )}
      <UserButton appearance={{ elements: { avatarBox: AVATAR_SIZE } }} />
    </Panel>
  );
}

// Display-only: no button, link or hover action.
function CollaboratorAvatar({ user }: { user: Collaborator }) {
  const className = `${AVATAR_SIZE} rounded-full ring-2 ring-surface-border-subtle`;
  if (user.avatar) {
    // Clerk avatar URLs are small and already sized by Clerk's CDN; next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatar} alt={user.name} className={`${className} object-cover`} />;
  }
  return (
    <span
      role="img"
      aria-label={user.name}
      style={{ backgroundColor: user.color }}
      className={`${className} flex items-center justify-center text-xs font-semibold text-(color:--bg-base)`}
    >
      {initials(user.name)}
    </span>
  );
}
