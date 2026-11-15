Let projects belong to an organization, so every member of the active organization can see and open them.

## Implementation

1. Add the organization link to `Project`.
   - in `prisma/models/project.prisma` add `organizationId String?` (Clerk organization ID; null means a personal project)
   - add `@@index([organizationId])`
   - create migration `add_project_organization`
   - existing projects stay personal (null)

2. Create projects in the active workspace.
   - `POST /api/projects` sets `organizationId` to `identity.orgId` (null in the personal workspace)

3. Scope the project list to the workspace.
   - update the listing used by `GET /api/projects` (`lib/projects.ts`):
     - organization workspace: "My Projects" shows every project with `organizationId = identity.orgId`
     - personal workspace: "My Projects" shows projects with `ownerId = identity.userId` and `organizationId = null`
     - "Shared" (collaborator by email) stays as it is in both workspaces
   - exclude `deletionPending` projects as today

4. Grant access to organization members.
   - in `getAccessibleProject` (`lib/project-access.ts`) add `{ organizationId: identity.orgId }` to the `OR` list when `identity.orgId` is set
   - this one change covers every route that already uses the helper: canvas, specs, AI design, AI spec, Liveblocks auth
   - add `organizationId` to the helper's `select`

## Scope Limits

- don't add role checks (next spec)
- don't move existing personal projects into organizations
- don't change the collaborator (share by email) model
- don't add billing

## Notes

- Access uses the **active** organization from the session. A member who belongs to several organizations must switch to the right one to open its projects. Record this in `architecture-context.md`.

## Check When Done

- A project created while an organization is active has its `organizationId` set.
- Another member of that organization sees it in My Projects and can open, edit, and run AI on it.
- Personal projects don't appear in the organization workspace, and the reverse.
- A non-member gets the existing access-denied screen.
- Migration applies cleanly with `prisma migrate dev`.
- `npm run build` passes.
