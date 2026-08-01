import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ─── Fuzzy Product Matching ─────────────────────────────────────────

/**
 * Find products matching a query string using pg_trgm similarity.
 * @param query - The search term (Arabic or English)
 * @param threshold - Minimum similarity score (0-1). Default 0.1 (catches loose matches)
 * @param limit - Max results. Default 10.
 */
export async function fuzzyMatchProducts(query: string, threshold = 0.1, limit = 10) {
  return prisma.$queryRaw<
    { id: string; name: string; name_ar: string; similarity: number }[]
  >`
    SELECT
      id, name, name_ar,
      GREATEST(
        similarity(name, ${query}),
        similarity(name_ar, ${query})
      ) AS similarity
    FROM products
    WHERE
      similarity(name, ${query}) > ${threshold}
      OR similarity(name_ar, ${query}) > ${query}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `;
}

// ─── Health Check ───────────────────────────────────────────────────

export async function healthCheck() {
  const dbOk = await prisma.$queryRaw<[{ ok: boolean }]>`SELECT true AS ok`;

  const extOk = await prisma.$queryRaw<[{ exists: boolean }]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
    ) AS exists
  `;

  const fuzzyOk = await prisma.$queryRaw<[{ sim: number }]>`
    SELECT similarity('tomato', 'tomato') AS sim
  `;

  return {
    database: !!dbOk,
    pg_trgm: !!extOk?.[0]?.exists,
    fuzzy_match: !!fuzzyOk,
  };
}
