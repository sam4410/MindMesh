# Architecture Context

## Stack

| Layer            | Technology              | Role                                                           |
| ---------------- | ----------------------- | -------------------------------------------------------------- |
| Framework        | Next.js 16 + TypeScript | Full-stack app with server/client boundaries                   |
| UI               | Tailwind + shadcn/ui    | Component composition and styling                              |
| Auth             | Clerk                   | User identity and route protection                             |
| Database         | Prisma + PostgreSQL     | Relational metadata: projects, collaborators, specs, task runs |
| Canvas           | Liveblocks + React Flow | Real-time collaborative canvas, presence, and cursors          |
| Background tasks | Trigger.dev             | Durable AI generation workflows                                |
| Artifact storage | Vercel Blob             | Canvas snapshots and generated Markdown specs                  |
| Billing          | Stripe                  | Subscriptions, checkout, customer portal                       |
| Monitoring       | Sentry                  | Error reporting                                                |

## System Boundaries

- `app/api` — Authenticated request handlers: input validation, ownership checks, task triggering, and persistence.
- `trigger` — Long-running background jobs: AI design generation and spec generation.
- `lib` — Shared infrastructure: Prisma client, access control helpers, and utilities.
- `components` — UI composition: canvas surfaces, sidebars, dialogs, and interactive elements.
- `prisma` — Database schema and generated client output.
- `data` — Legacy local directory. Not used for new artifacts.

## Storage Model

- **Database**: metadata, ownership, relationships, and task run records.
- **Vercel Blob**: generated artifacts — canvas snapshots at `canvas/{projectId}.json`, specs at `specs/{projectId}/{specId}.md`, saved canvas versions at `versions/{projectId}/{versionId}.json`, and generated infrastructure code at `iac/{projectId}/{bundleId}.zip`.
- Project records, spec records, and task run records belong in PostgreSQL.
- Canvas content and Markdown output are stored in and retrieved from Vercel Blob.
- The blob URL is stored in the database (`canvasJsonPath`, `filePath`) as the reference to the artifact.

## Auth and Collaboration Model

- Every project has a single owner (Clerk user ID).
- Projects can include additional collaborators.
- Only authenticated users can access protected routes.
- Only the owner or a collaborator can mutate project resources.
- Project roles (`getProjectRole` in `lib/project-access.ts`): owner, admin (organization project, `org:admin` in the active organization), member (organization project, active organization), collaborator (access by email). Everyone with access can open, edit the canvas, chat, run AI, and generate specs. Anyone with access can also change the project's design context (`PATCH /api/projects/[projectId]` with only `designContext`). Only owners and admins can rename, delete, or manage collaborators (`requireProjectManager`: 404 without access, 403 without the role). `canManageProject` lives in the client-safe `lib/project-roles.ts`.
- Liveblocks room tokens are issued only after verifying project membership.
- Projects can belong to a Clerk organization; members of that organization can access its projects.
- Project ownership by workspace: `Project.organizationId` holds the Clerk organization ID, or null for a personal project. New projects are created in the active workspace. Existing projects stay personal. Organization-project ownership does not bypass active organization membership; removing a member revokes direct access even if `ownerId` still matches. Independently granted collaborator access is unchanged.
- Organization access uses the **active** organization from the session (`auth().orgId`). A member of several organizations must switch to the right one to see and open its projects. "My Projects" lists the active organization's projects, or the user's personal projects in the personal workspace; "Shared" (collaborator by email) is the same in every workspace.
- Roles are owner, admin, member, and collaborator.
- Clerk Organizations is enabled. Personal accounts stay enabled, so users keep a personal workspace. Clerk's default roles are used: `org:admin` (organization creators) and `org:member` (default for invited members). The active organization and role come from `auth()` (`orgId`, `orgRole`) and are exposed on `Identity`.

## Starter System Designs

- Prebuilt templates are static canvas snapshots stored in the codebase.
- Templates are loaded into the active Liveblocks room when a user imports one.
- Import can occur on canvas creation or from within the editor at any time.
- Template data follows the same node/edge schema as user-created canvas content.
- Templates do not require a separate database record; they are resolved by template ID at import time.

## AI Generation Model

### Design Generation

- Input: user prompt, project context, and current canvas state.
- Execution: durable background task via Trigger.dev.
- Output: structured node and edge updates written into the shared Liveblocks room.

### Spec Generation

- Input: current canvas graph and project context.
- Execution: durable background task via Trigger.dev.
- Output: Markdown technical spec saved to the filesystem and linked to the project in the database.

## Invariants

1. Request handlers do not run long-lived AI work — that belongs in background tasks.
2. Metadata and large generated artifacts are stored in separate layers.
3. Auth and ownership are enforced at every mutation boundary.
4. Client components are used only where browser interactivity or real-time state requires them.
5. The canvas schema must remain consistent between user-created content and imported templates.
6. Plan limits are enforced server-side before any AI task is triggered.
7. Integration credentials are encrypted at rest and never returned to the client.
8. Design context is read from the project record on the server, never trusted from the client.
9. External API calls made in request handlers must be short; anything AI-driven runs in Trigger.dev.
