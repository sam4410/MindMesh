import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  // Fail loudly: an empty URL surfaces later as a cryptic SASL password error from pg.
  if (!url) throw new Error("DATABASE_URL is not set");

  // Driver adapters can't speak the Accelerate protocol, so Accelerate URLs go through accelerateUrl.
  if (url.startsWith("prisma+postgres://")) {
    return new PrismaClient({ accelerateUrl: url });
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Reuse one client across hot reloads so dev doesn't exhaust database connections.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
