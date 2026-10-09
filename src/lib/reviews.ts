import type { Prisma } from "@prisma/client";

/** Recomputes a property's rating aggregates from its published reviews. */
export async function refreshRating(tx: Prisma.TransactionClient, propertyId: string): Promise<void> {
  const stats = await tx.review.aggregate({
    where: { propertyId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await tx.property.update({
    where: { id: propertyId },
    data: { ratingAvg: Math.round((stats._avg.rating ?? 0) * 100) / 100, ratingCount: stats._count._all },
  });
}
