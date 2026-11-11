# Prisma Accelerate Users

Special migration instructions for users of Prisma Accelerate or Prisma Postgres with `prisma://` or `prisma+postgres://` URLs.

## Important

**Prisma Accelerate, including hosted Accelerate connections for Prisma Postgres,
will be retired on December 1, 2026.** Before then, follow the documented
transition path for your setup:

- [Keep your existing database and remove Accelerate](https://www.prisma.io/docs/accelerate/keep-your-database)
- [Connect to Prisma Postgres without Accelerate](https://www.prisma.io/docs/postgres/database/switch-from-accelerate)
- [Migrate a PostgreSQL database to Prisma Postgres](https://www.prisma.io/docs/prisma-postgres/import-from-existing-database-postgresql)

**Do NOT pass Accelerate URLs to driver adapters.**

Driver adapters (like `PrismaPg`) expect direct database connection strings. They will fail with `prisma://` or `prisma+postgres://` URLs.

## Correct v7 Setup for Accelerate

### 1. Keep your Accelerate URL

```env
# .env
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=..."
# or
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/..."
```

### 2. Install Accelerate extension

```bash
npm install @prisma/extension-accelerate
```

### 3. Configure prisma.config.ts

```typescript
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),  // Accelerate URL works here
  },
})
```

### 4. Instantiate client with accelerateUrl

```typescript
import { PrismaClient } from '../generated/client'
import { withAccelerate } from '@prisma/extension-accelerate'

// Use accelerateUrl instead of adapter
export const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate())
```

## What NOT to Do

```typescript
// ❌ WRONG - Don't use adapter with Accelerate URL
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL  // This will fail with prisma://
})
```

## Migrations with Accelerate

### `prisma://` Accelerate URLs

Use `prisma://` with Prisma Client's `accelerateUrl` at runtime. Prisma Migrate
and introspection commands such as `prisma db pull` require a direct database
URL; they cannot use the Accelerate proxy URL.

### `prisma+postgres://` URLs

Hosted Prisma Postgres `prisma+postgres://` URLs are supported by Prisma Client
through `accelerateUrl`. For migrations and introspection, configure
`prisma.config.ts` with the database's direct PostgreSQL URL instead. This is
also the required path when Prisma CLI needs direct database access.

### Configure a direct URL for Prisma CLI

```env
DATABASE_URL="prisma://..."               # Accelerate at app runtime
DIRECT_DATABASE_URL="postgresql://..."    # Prisma CLI migrations/introspection
```

```typescript
// prisma.config.ts
export default defineConfig({
  datasource: {
    url: env('DIRECT_DATABASE_URL'),
  },
})
```

## Prisma Postgres (Cloud)

If using Prisma Postgres cloud database:

### Same approach

```typescript
import { PrismaClient } from '../generated/client'
import { withAccelerate } from '@prisma/extension-accelerate'

export const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,  // prisma+postgres:// URL
}).$extends(withAccelerate())
```

## Switching Away from Accelerate

If you later switch to direct TCP connection:

```typescript
// Change from accelerateUrl to adapter
import { PrismaClient } from '../generated/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL  // Direct postgres:// URL
})

export const prisma = new PrismaClient({ adapter })
```

## Caching with Accelerate

The extension enables caching:

```typescript
const users = await prisma.user.findMany({
  cacheStrategy: {
    ttl: 60,  // Cache for 60 seconds
    swr: 120, // Stale-while-revalidate for 120 seconds
  },
})
```

## Edge Runtime

Accelerate works great in edge runtimes:

```typescript
// Works in Vercel Edge, Cloudflare Workers, etc.
import { PrismaClient } from '../generated/client'
import { withAccelerate } from '@prisma/extension-accelerate'

export const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate())
```
