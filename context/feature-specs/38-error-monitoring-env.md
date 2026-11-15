Add error monitoring, fail-fast environment validation, and a production deployment checklist.

## Implementation

1. Add Sentry.
   - install `@sentry/nextjs`
   - follow the Sentry Next.js setup for the App Router: `instrumentation.ts` (server and edge) and `instrumentation-client.ts`
   - check `node_modules/next/dist/docs/` for the instrumentation file conventions in this Next.js version, per `AGENTS.md`
   - read the DSN from `NEXT_PUBLIC_SENTRY_DSN`; when it is not set, Sentry stays disabled (local development)
   - in the existing `catch` blocks of the AI and billing routes that return 502 or 500, add `Sentry.captureException(err)` next to `console.error`

2. Validate environment variables at startup.
   - create `lib/env.ts` with a Zod schema for required server variables: `DATABASE_URL`, `CLERK_SECRET_KEY`, `LIVEBLOCKS_SECRET_KEY`, `BLOB_READ_WRITE_TOKEN`, `TRIGGER_SECRET_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_TEAM`, `NEXT_PUBLIC_APP_URL`
   - call it from the server `register()` in `instrumentation.ts`
   - on failure, throw an error listing the **names** of missing variables; never print values

3. Write `context/deployment.md`.
   - Clerk: production instance, production keys, custom domain, application name
   - Database: `prisma migrate deploy` against production before each release
   - Trigger.dev: paid plan, `npx trigger.dev deploy`, production environment variables, failure alerts set up in the dashboard
   - Stripe: live keys, live price ID, webhook endpoint and secret
   - Vercel: environment variables per environment, Sentry DSN
   - include the Windows `trigger dev --env-file .env.local` note for local development

## Scope Limits

- don't add Sentry to Trigger.dev tasks (use Trigger.dev's own failure alerts)
- don't add performance tracing or session replay
- don't change application behavior

## Check When Done

- A thrown error in an API route appears in Sentry when the DSN is set.
- Removing a required variable stops startup with a message naming it.
- `context/deployment.md` covers every item above.
- `npm run build` passes.
