/**
 * Prisma Client Singleton
 *
 * This module creates a singleton instance of the Prisma client
 * to prevent multiple connections during development hot reloading.
 */

import { PrismaClient } from "@prisma/client";

// Declare global type for the Prisma client
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create a singleton Prisma client
// In development, reuse the client across hot reloads
// In production, create a new client
export const prisma = global.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// In development, attach the client to the global object
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

/**
 * Gracefully disconnect Prisma on process exit
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Test the database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("[Prisma] Database connection failed:", error);
    return false;
  }
}
