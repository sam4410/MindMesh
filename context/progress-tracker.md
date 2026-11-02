# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase
- Feature 04 (Project Dialogs) — complete

## Current Goal
- Feature 05 (TBD — no spec yet)

## Completed

- Feature 01: Design System — shadcn/ui (base-nova preset, @base-ui/react primitives) configured for Tailwind v4. Dark-only palette from ui-context.md in globals.css, with shadcn variables mapped onto it. Button/Card/Dialog/Input/Tabs/Textarea/ScrollArea in components/ui/. lucide-react installed. lib/utils.ts re-exports cn() from the `cn` package (clsx + tailwind-merge replacement). TypeScript, ESLint and build clean.
- Feature 02: Editor Chrome — components/editor/editor-navbar.tsx (fixed-height top bar, left/center/right sections, PanelLeftOpen/PanelLeftClose toggle). components/editor/project-sidebar.tsx (floating overlay sliding from left, isOpen/onClose, Projects header + close, My Projects/Shared tabs with empty states, full-width New Project button, currently disabled). components/editor/editor-dialog.tsx dialog pattern (title, description, footer actions). app/editor/layout.tsx frames /editor with both via components/editor/editor-shell.tsx. TypeScript, ESLint and build clean.
- Feature 03: Auth — @clerk/ui installed. ClerkProvider wraps the root layout with Clerk's `dark` theme; appearance variables in lib/clerk-appearance.ts point at globals.css CSS variables (no hardcoded colors). Sign-in/sign-up pages at app/(auth)/sign-in/[[...sign-in]] and app/(auth)/sign-up/[[...sign-up]] share app/(auth)/layout.tsx: 50/50 split on lg+ (left bg-surface panel with logo, headline, intro, three features with icon tiles, copyright | centered Clerk form on bg-base), form only below lg. Feature list uses icons per a reference design from the user, superseding the spec's "text-only" wording. proxy.ts at project root keeps /sign-in and /sign-up (from NEXT_PUBLIC_CLERK_SIGN_IN_URL / NEXT_PUBLIC_CLERK_SIGN_UP_URL) public and calls auth.protect() for everything else, including /api. `/` redirects signed-in users to /editor and signed-out users to /sign-in. UserButton in the editor navbar's right section. Build, TypeScript and ESLint clean; signed-out redirects verified (307 to /sign-in for /, /editor, /api/*).
- Feature 04: Project Dialogs — /editor home (components/editor/editor-home.tsx): centered heading, description and New Project button, no card. hooks/use-project-dialogs.ts owns projects (mock), dialog, form (name + derived slug) and loading state, shared through ProjectDialogsContext from EditorShell. components/editor/project-dialogs.tsx renders Create (live slug preview), Rename (prefilled, current name in description, autofocus, Enter submits) and Delete (destructive confirm, no input) through EditorDialog. Sidebar lists My Projects / Shared from lib/projects.ts mock data; rename/delete actions only on owned projects; New Project enabled and wired to Create; mobile scrim closes the sidebar on outside tap. Changes live in local state only (no API, no persistence). TypeScript, ESLint and build clean; toSlug spot-checked. Signed-in UI not yet browser-verified.

## In Progress

- None.

## Next Up
- TBD



## Open Questions

- None yet.

## Architecture Decisions

- Project dialogs: one useProjectDialogs() instance lives in EditorShell and is shared via ProjectDialogsContext, so the server /editor page's client EditorHome and the sidebar open the same dialogs. Mock data and toSlug live in lib/projects.ts (components stay UI-only).
- Route protection: proxy.ts uses bare clerkMiddleware with a plain path check, not createRouteMatcher (deprecated in @clerk/nextjs 7). Per Clerk guidance, pages, route handlers and server functions that touch user data should also call `await auth.protect()` themselves.
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
- .env.local lives in build-saas-app/ (Next.js only loads env files from the project root). It holds NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in, NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up. proxy.ts throws at startup if the sign-in/sign-up URLs are missing.
