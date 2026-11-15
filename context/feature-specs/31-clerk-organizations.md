Enable team workspaces using Clerk Organizations. This unit adds the organization switcher and exposes the active organization to server code. Projects are not scoped to organizations yet.

## Implementation

1. Enable Organizations in the Clerk dashboard.
   - keep personal accounts enabled, so a user can still work in a personal workspace
   - use Clerk's default roles: `org:admin` and `org:member`
   - new members join as `org:member`
   - record these settings in `context/architecture-context.md` under Auth and Collaboration Model

2. Add the organization switcher.
   - use `OrganizationSwitcher` from `@clerk/nextjs`
   - place it in the header of `components/editor/project-sidebar.tsx`, above the My Projects / Shared tabs
   - set `afterSelectOrganizationUrl="/editor"` and `afterSelectPersonalUrl="/editor"` so the project list reloads in the new workspace
   - set `afterCreateOrganizationUrl="/editor"`
   - style it with the existing `lib/clerk-appearance.ts` appearance so it matches the dark UI

3. Expose the active organization on the server.
   - extend `Identity` in `lib/project-access.ts` with:
     - `orgId: string | null`
     - `orgRole: string | null`
   - read both from `auth()` inside `getCurrentIdentity`
   - keep `getCurrentIdentity` cached per request with `cache()`

## Scope Limits

- don't add a Prisma field or migration
- don't change project listing, creation, or access rules
- don't add billing or role checks
- don't build custom organization or invitation UI; Clerk's switcher handles create, switch, and invite

## Notes

- Check `node_modules/next/dist/docs/` before changing server code, per `AGENTS.md`.
- The Clerk skill in `.agents/skills/clerk-nextjs-patterns` covers organization patterns.

## Check When Done

- The organization switcher appears in the project sidebar.
- A user can create an organization, invite a member, and switch between personal and organization workspaces.
- `getCurrentIdentity()` returns `orgId` and `orgRole` for the active workspace.
- Existing project behavior is unchanged.
- `npm run build` passes.
