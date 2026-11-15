Add public Terms, Privacy, and Trust pages, and require consent at sign-up.

## Implementation

1. Create the pages.
   - `app/(legal)/layout.tsx`: simple public layout with the MindMesh logo, a readable content width, and a footer
   - `app/(legal)/terms/page.tsx`
   - `app/(legal)/privacy/page.tsx`
   - `app/(legal)/trust/page.tsx` covering:
     - customer designs, chats, and specs are not used to train AI models
     - where data is stored: PostgreSQL (project metadata), Vercel Blob (canvases, specs, versions), Liveblocks (live canvas and chat)
     - subprocessors: Vercel, Clerk, Liveblocks, Trigger.dev, OpenAI, Google, Stripe, Prisma Postgres, Sentry
     - deleting a project deletes its canvas, specs, and versions
   - write Terms and Privacy as clearly marked drafts with `[Company name]` and `[Contact email]` placeholders and a visible "Draft – requires legal review" note

2. Make them public.
   - in `proxy.ts` add `/terms`, `/privacy`, and `/trust` to the public paths

3. Link to them.
   - footer links in `app/(auth)/layout.tsx`, next to the copyright line
   - links on the editor home screen footer

4. Require consent at sign-up.
   - enable "Require express consent to legal documents" in the Clerk dashboard with the Terms and Privacy URLs
   - document the setting in `context/deployment.md`

## Scope Limits

- don't write final legal text; drafts only
- don't add a cookie banner (the app uses only essential cookies)
- don't add a marketing site

## Check When Done

- `/terms`, `/privacy`, and `/trust` load without signing in.
- Sign-in and editor home pages link to them.
- Sign-up asks for consent once the Clerk setting is enabled.
- `npm run build` passes.
