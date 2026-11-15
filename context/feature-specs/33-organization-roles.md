Enforce roles on project management actions, so organization members can work on designs but only owners and admins can rename, delete, or share projects.

## Implementation

1. Add a role helper.
   - in `lib/project-access.ts` add `getProjectRole(project, identity)` returning `"owner" | "admin" | "member" | "collaborator"`:
     - `owner`: `project.ownerId === identity.userId`, and for an organization project the user must still be in its active organization
     - `admin`: organization project and `identity.orgRole === "org:admin"`
     - `member`: organization project and the user is in that organization
     - `collaborator`: access came through the collaborator email
   - add `canManageProject(role)` that is true for `owner` and `admin`

2. Apply this permission matrix.

   | Action | owner | admin | member | collaborator |
   | --- | --- | --- | --- | --- |
   | Open, edit canvas, chat, run AI, generate specs | yes | yes | yes | yes |
   | Rename project | yes | yes | no | no |
   | Delete project | yes | yes | no | no |
   | Add or remove collaborators | yes | yes | no | no |

3. Enforce it in the API.
   - `PATCH` and `DELETE /api/projects/[projectId]`: return 403 `{ error: "Only the owner or an admin can do this" }` when not allowed
   - `POST /api/projects/[projectId]/collaborators` and `DELETE .../collaborators/[collaboratorId]`: same rule
   - keep the existing 404 for no access

4. Reflect it in the UI.
   - include `role` in the project summary returned by `GET /api/projects` and in the workspace page data
   - in `project-sidebar.tsx` hide Rename and Delete when the role can't manage the project
   - in `share-dialog.tsx` show the collaborator list read-only for members and collaborators

## Scope Limits

- don't add custom roles or a role editor
- don't change who can edit the canvas or run AI
- don't add billing permissions (handled in the billing specs)

## Check When Done

- An organization member can edit a design but gets 403 on rename, delete, and collaborator changes.
- An organization admin and the project owner can do all actions.
- The sidebar and share dialog hide actions the user can't perform.
- `npm run build` passes.
