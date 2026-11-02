# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase
- Feature 09 (Share Dialog) — complete

## Current Goal
- Feature 10 (TBD — no spec yet)

## Completed

- Feature 01: Design System — shadcn/ui (base-nova preset, @base-ui/react primitives) configured for Tailwind v4. Dark-only palette from ui-context.md in globals.css, with shadcn variables mapped onto it. Button/Card/Dialog/Input/Tabs/Textarea/ScrollArea in components/ui/. lucide-react installed. lib/utils.ts re-exports cn() from the `cn` package (clsx + tailwind-merge replacement). TypeScript, ESLint and build clean.
- Feature 02: Editor Chrome — components/editor/editor-navbar.tsx (fixed-height top bar, left/center/right sections, PanelLeftOpen/PanelLeftClose toggle). components/editor/project-sidebar.tsx (floating overlay sliding from left, isOpen/onClose, Projects header + close, My Projects/Shared tabs with empty states, full-width New Project button, currently disabled). components/editor/editor-dialog.tsx dialog pattern (title, description, footer actions). app/editor/layout.tsx frames /editor with both via components/editor/editor-shell.tsx. TypeScript, ESLint and build clean.
- Feature 03: Auth — @clerk/ui installed. ClerkProvider wraps the root layout with Clerk's `dark` theme; appearance variables in lib/clerk-appearance.ts point at globals.css CSS variables (no hardcoded colors). Sign-in/sign-up pages at app/(auth)/sign-in/[[...sign-in]] and app/(auth)/sign-up/[[...sign-up]] share app/(auth)/layout.tsx: 50/50 split on lg+ (left bg-surface panel with logo, headline, intro, three features with icon tiles, copyright | centered Clerk form on bg-base), form only below lg. Feature list uses icons per a reference design from the user, superseding the spec's "text-only" wording. proxy.ts at project root keeps /sign-in and /sign-up (from NEXT_PUBLIC_CLERK_SIGN_IN_URL / NEXT_PUBLIC_CLERK_SIGN_UP_URL) public and calls auth.protect() for everything else, including /api. `/` redirects signed-in users to /editor and signed-out users to /sign-in. UserButton in the editor navbar's right section. Build, TypeScript and ESLint clean; signed-out redirects verified (307 to /sign-in for /, /editor, /api/*).
- Feature 04: Project Dialogs — /editor home (components/editor/editor-home.tsx): centered heading, description and New Project button, no card. hooks/use-project-dialogs.ts owns projects (mock), dialog, form (name + derived slug) and loading state, shared through ProjectDialogsContext from EditorShell. components/editor/project-dialogs.tsx renders Create (live slug preview), Rename (prefilled, current name in description, autofocus, Enter submits) and Delete (destructive confirm, no input) through EditorDialog. Sidebar lists My Projects / Shared from lib/projects.ts mock data; rename/delete actions only on owned projects; New Project enabled and wired to Create; mobile scrim closes the sidebar on outside tap. Changes live in local state only (no API, no persistence). TypeScript, ESLint and build clean; toSlug spot-checked. Signed-in UI not yet browser-verified.
- Feature 05: Prisma — prisma/models/project.prisma (multi-file schema; prisma7.config.ts points `schema` at the prisma/ folder): Project (cuid id, ownerId = Clerk user ID, name, description?, status ProjectStatus DRAFT/ARCHIVED default DRAFT, canvasJsonPath?, createdAt/updatedAt, indexes on ownerId and createdAt) and ProjectCollaborator (cuid id, project relation onDelete Cascade, email, createdAt, unique [projectId, email], indexes on email and [projectId, createdAt]). lib/prisma.ts exports one cached PrismaClient: accelerateUrl for prisma+postgres:// URLs, @prisma/adapter-pg otherwise, throws if DATABASE_URL is unset, cached on globalThis outside production. Migration 20261102103706_init applied to local Postgres 17 (ghost_ai); client generated to app/generated/prisma (gitignored). Smoke-tested create, unique constraint and cascade delete. TypeScript, ESLint and npm run build clean.
- Feature 06: Project APIs — app/api/projects/route.ts (GET lists the signed-in user's own projects newest first; POST creates with ownerId = Clerk userId, missing/blank name → "Untitled Project", cuid IDs, 201) and app/api/projects/[projectId]/route.ts (PATCH renames, DELETE removes → 204; both owner-only: 401 signed out, 404 unknown project, 403 non-owner). lib/project-input.ts parses the optional name (400 for malformed JSON, non-string or >100 chars). proxy.ts now answers signed-out /api requests with 401 JSON instead of auth.protect()'s 404; handlers still check auth() themselves. Backend only, UI still on mock data. Verified: 401 for all four routes through the production server; 17 handler checks (create/list/rename/delete, 400/401/403/404) against local ghost_ai with a stubbed Clerk user. TypeScript, ESLint and npm run build clean.
- Feature 07: Wire Editor Home — lib/projects.ts getProjectsForUser(userId, email) returns owned + shared (collaborator email match, lowercased) project summaries {id, name}; mock data removed, toSlug moved to lib/slug.ts. app/editor/layout.tsx fetches them server-side (currentUser() inside Suspense) and passes both lists through EditorShell to the sidebar; actions only on owned. hooks/use-project-actions.ts (replaces use-project-dialogs) owns dialog state and mutations: Create builds room ID = slug(name or "untitled-project") + 8-char random suffix, POSTs it as the project id, then router.push(/editor/{id}) + refresh; Rename PATCHes then refreshes; Delete DELETEs, then pushes /editor if it was the active workspace (useParams projectId), else refreshes. API errors show in the dialog. POST /api/projects accepts an optional slug-format id (400 if malformed, 409 if taken), falling back to cuid. Verified: 12 checks on POST ids and the helper against local ghost_ai; TypeScript, ESLint and npm run build clean. Signed-in browser flow not yet verified; /editor/[id] workspace page not built yet (spec doesn't include it), so Create lands on a 404 for now.
- Feature 08: Editor Workspace Shell — lib/project-access.ts: getCurrentIdentity() (Clerk userId + lowercased primary email, React cache() per request, shared by the editor layout and page) and getAccessibleProject(id, identity) (owner or collaborator, else null). app/editor/[roomId]/page.tsx (server): signed out → sign-in redirect; missing or unauthorized project → components/editor/access-denied.tsx (centered, lock icon, message, link to /editor); otherwise a dark centered canvas placeholder filling <main>. EditorShell reads roomId via useParams and, when it matches an accessible project, gives the navbar the project name plus a disabled Share button and an AI sidebar toggle, highlights the room in ProjectSidebar (accent-dim row, aria-current), and renders components/editor/ai-sidebar.tsx, a right slide-over placeholder. Sidebar rows now link to /editor/{id}. use-project-actions reads the active room from `roomId`. Verified: access helper (owner, collaborator, stranger, missing) against local ghost_ai; signed-out /editor/[roomId] redirects to sign-in. TypeScript, ESLint and npm run build clean. Signed-in browser flow not yet verified.
- Feature 09: Share Dialog — navbar Share button (workspace only) opens components/editor/share-dialog.tsx. Owners get an email invite form, a remove button per collaborator and a "Copy link" footer button (copies {origin}/editor/{id}, shows "Copied!" for 2s); collaborators see the list only. The list refetches on every open. APIs: GET /api/projects/[projectId]/collaborators (owner or collaborator; 401/404) returns [{id, email, name, imageUrl}], enriched with one Clerk getUserList call by email (name = fullName or username; unknown emails and Clerk failures fall back to email only). POST (owner only; email trimmed + lowercased, validated, 409 if already invited) and DELETE /api/projects/[projectId]/collaborators/[collaboratorId] (owner only; scoped to the project, 404 otherwise). The owner check moved from the project route into lib/project-access.ts requireOwner(). No local user table. Verified: 20 handler checks against local ghost_ai with a stubbed Clerk (auth, enrichment, fallback, Clerk outage, cross-project delete). TypeScript, ESLint and npm run build clean. Signed-in browser flow not yet verified.

## In Progress

- None.

## Next Up
- TBD



## Open Questions

- None yet.

## Architecture Decisions

- Prisma 7.10.1 pinned exactly: npm's `latest` tag points at 8.0.0-rc, whose CLI dropped `init --output`. Generated client is gitignored, so fresh clones must run `npx prisma generate`.
- Accelerate path uses the PrismaClient `accelerateUrl` option without @prisma/extension-accelerate (not installed); add the extension only when query caching is needed.
- Project actions: one useProjectActions() instance lives in EditorShell and is shared via ProjectActionsContext, so EditorHome and the sidebar open the same dialogs. Project lists are fetched in app/editor/layout.tsx (not the page) because the sidebar lives in the layout and must have data on every /editor screen. Project ID = Liveblocks room ID (slug + random suffix), generated client-side and validated by POST /api/projects.
- Route protection: proxy.ts uses bare clerkMiddleware with a plain path check, not createRouteMatcher (deprecated in @clerk/nextjs 7). Pages go through auth.protect() (redirect to sign-in); /api routes get a 401 JSON response from the proxy because auth.protect() returns 404 for non-page requests. Per Clerk guidance, pages, route handlers and server functions that touch user data should also call `await auth.protect()` themselves.
- Clerk applies ~10% alpha to `colorBorder`, so it is set to var(--text-primary) (not --border-default) to keep form borders visible on dark.
- Cache Components is on (next.config.ts), so anything calling auth()/currentUser() and Clerk's catch-all SignIn/SignUp pages render inside <Suspense>.
- Editor chrome: app/editor/layout.tsx (server) renders components/editor/editor-shell.tsx (client), which owns sidebar open state and frames every /editor screen with EditorNavbar + ProjectSidebar.
- Dialogs: app-level components/editor/editor-dialog.tsx (title, description, footer) wraps shadcn Dialog to apply the rounded-3xl modal styling, so components/ui/dialog.tsx stays untouched.

- shadcn/ui over Tailwind v4 (CSS-based token config via @theme inline in globals.css, no tailwind.config.js).
- Dark-only theme: all shadcn :root variables set to dark values directly — no .dark class switching. A static `dark` class sits on <html> so the `dark:` utilities in generated components always apply.
- Background tokens use Tailwind's `--background-color-*` namespace so `bg-base` doesn't collide with the `text-base` font-size utility.
- Do not modify generated components/ui/* files after shadcn installation.
- Next.js 16 uses proxy.ts (not middleware.ts) — same API, renamed to reflect its purpose.

## Session Notes

- Next.js 16.4.3 with React 19.3.0 and Tailwind CSS v4.
- shadcn CLI 4.23.0 (base-nova preset); it auto-detected Tailwind v4.
- lucide-react ^1.66.0 installed as a direct dependency.
- @clerk/nextjs ^7.9.23 and @clerk/ui ^1.42.2 installed.
- Prisma 7.10.1 (prisma, @prisma/client, @prisma/adapter-pg) with pg; local PostgreSQL 17 database ghost_ai. DATABASE_URL lives in .env (read by both the Prisma CLI via dotenv and Next.js).
- .env.local lives in build-saas-app/ (Next.js only loads env files from the project root). It holds NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in, NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up. proxy.ts throws at startup if the sign-in/sign-up URLs are missing.
