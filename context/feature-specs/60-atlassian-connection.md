Let a workspace connect its Atlassian site (Jira and Confluence) with an API token, stored encrypted. This unit adds the connection only; publishing and issue creation come next.

## Billing Deferred

Billing and usage limits (specs 34–39) are deferred. Until they are implemented:

- `lib/env.ts` doesn't exist (spec 38 is deferred): don't create it; document `INTEGRATIONS_ENCRYPTION_KEY` in the Session Notes of `context/progress-tracker.md` instead
- `lib/crypto.ts` throws a clear error naming the variable when it is missing

## Implementation

1. Add encryption helpers: `lib/crypto.ts`.
   - AES-256-GCM with Node `crypto`, key from `INTEGRATIONS_ENCRYPTION_KEY` (32 bytes, base64)
   - `encryptSecret(plain): string` returns `base64(iv) . base64(tag) . base64(ciphertext)` with a random 12-byte IV
   - `decryptSecret(value): string` throws on tampering
   - add an assert-based self-check (round trip, tampered value fails) run with `node --import tsx --test`

2. Add the `Integration` model.
   - `prisma/models/integration.prisma`:
     - `id String @id @default(cuid())`
     - `billingAccountId String` (organization ID or user ID, same as billing)
     - `provider IntegrationProvider` enum `ATLASSIAN`
     - `siteUrl String`, `email String`, `encryptedToken String`
     - `createdById String`, `createdAt`, `updatedAt`
     - `@@unique([billingAccountId, provider])`
   - create migration `add_integration`

3. Add the routes.
   - `GET /api/integrations`: returns `[{ provider, siteUrl, email, connectedAt }]` for the active workspace; never the token
   - `PUT /api/integrations/atlassian` with `{ siteUrl, email, apiToken }`:
     - organization admin or personal workspace only (403 otherwise)
     - `siteUrl` must match `https://<name>.atlassian.net`
     - verify with `GET {siteUrl}/rest/api/3/myself` using basic auth (`email:apiToken`) and a 10-second timeout; 400 `{ error: "Couldn't connect with these details" }` on failure
     - encrypt the token and upsert the row
   - `DELETE /api/integrations/atlassian`: same permission rule; deletes the row

4. Add the settings page.
   - `app/settings/integrations/page.tsx`: Atlassian card showing connected site and email, or a form (site URL, email, API token as a password input) with a link to Atlassian's API token page
   - Disconnect button for admins
   - link to it from the `UserButton` menu next to Billing

## Scope Limits

- don't add OAuth (API tokens only); `shortcut:` move to Atlassian OAuth 2.0 when customers ask for per-user permissions
- don't publish to Confluence or create Jira issues yet
- never log or return the token

## Notes

- New env var: `INTEGRATIONS_ENCRYPTION_KEY` (generate with `openssl rand -base64 32`); add it to `lib/env.ts`.

## Check When Done

- An admin can connect a real Atlassian site; wrong details return 400.
- The database stores only the encrypted token.
- `GET /api/integrations` never includes the token.
- The crypto self-check passes.
- `npm run build` passes.
