Add comment threads on canvas nodes using Liveblocks Comments, so reviewers can discuss specific components.

## Implementation

1. Type the thread metadata.
   - in `liveblocks.config.ts` add `ThreadMetadata: { nodeId: string }`

2. Resolve user names and avatars.
   - add `GET /api/users?ids=a,b,c`: authenticated; max 50 IDs; returns `[{ id, name, avatar }]` from `clerkClient().users.getUserList({ userId: ids })`; returns only name and image, never email
   - pass `resolveUsers` to the `LiveblocksProvider` in `components/editor/collaborative-canvas.tsx`, calling that route and returning `{ name, avatar }` in the requested order
   - the AI agent ID (`ghost-ai`) resolves to `AI_AGENT.info` locally without a request

3. Add comments to nodes.
   - add a "Comment" button to the node selection toolbar (single node selected)
   - it opens a popover anchored to the node showing:
     - threads for that node from `useThreads({ query: { metadata: { nodeId } } })`, rendered with `Thread` from `@liveblocks/react-ui`
     - a `Composer` that creates a new thread with `metadata: { nodeId }`
   - import `@liveblocks/react-ui/styles.css` and the dark theme stylesheet; adjust colors with Liveblocks CSS variables, not by editing `components/ui`

4. Show comment counts.
   - in `components/editor/canvas-node.tsx`, show a small comment badge with the number of unresolved threads for the node
   - read counts once at the canvas level with `useThreads()` and pass them down, so each node doesn't subscribe separately

## Scope Limits

- don't add email or inbox notifications
- don't handle threads on deleted nodes (they stay in Liveblocks but aren't shown); record this in `progress-tracker.md` as a known limitation
- don't add comments on edges or the canvas background

## Notes

- Load the `liveblocks-best-practices` skill references for comments and `resolveUsers` before implementing.
- The Liveblocks auth route already scopes room access to project members, which also covers comments.

## Check When Done

- A user can open a node's comments, start a thread, and reply.
- Another collaborator sees the thread live, with correct names and avatars.
- Nodes show an unresolved-thread count.
- `npm run build` passes.
