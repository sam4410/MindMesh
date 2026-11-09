import { PrismaPg } from "@prisma/adapter-pg";
import { withAccelerate } from "@prisma/extension-accelerate";

import { PrismaClient } from "@/app/generated/prisma/client";

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  // Fail loudly: an empty URL surfaces later as a cryptic SASL password error from pg.
  if (!url) throw new Error("DATABASE_URL is not set");

  // Driver adapters can't speak the Accelerate protocol.
  const client =
    url.startsWith("prisma+postgres://") || url.startsWith("prisma://")
      ? new PrismaClient({ accelerateUrl: url })
      : new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  return client.$extends(withAccelerate());
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Reuse one client across hot reloads so dev doesn't exhaust database connections.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
