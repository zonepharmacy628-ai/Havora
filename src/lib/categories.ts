import "server-only";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";

export type CategoryOption = { id: string; name: string };
export type CategoryRequest = { id: string; name: string; description: string | null; requestedBy: string | null };

export type CategoryFormData = {
  /** Live categories, selectable by every host. */
  active: CategoryOption[];
  /** This user's own requests that are still waiting for an administrator. */
  myPending: CategoryOption[];
  /** This user's recently declined requests, with the administrator's reason. */
  myDeclined: { id: string; name: string; reason: string | null }[];
  /** Administrators only: every owner request waiting for a decision. */
  toReview: CategoryRequest[];
};

/** Everything the category selector in the Add Property form needs for this user. */
export async function getCategoryFormData(user: { id: string; role: Role }): Promise<CategoryFormData> {
  const isAdmin = user.role === "ADMIN";
  const [active, myPending, myDeclined, toReview] = await Promise.all([
    prisma.category.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    isAdmin
      ? Promise.resolve([])
      : prisma.category.findMany({
          where: { status: "PENDING", requestedById: user.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true },
        }),
    isAdmin
      ? Promise.resolve([])
      : prisma.category.findMany({
          where: { status: "REJECTED", requestedById: user.id },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, name: true, rejectionReason: true },
        }),
    isAdmin
      ? prisma.category.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, description: true, requestedBy: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);
  return {
    active,
    myPending,
    myDeclined: myDeclined.map((c) => ({ id: c.id, name: c.name, reason: c.rejectionReason })),
    toReview: toReview.map((c) => ({ id: c.id, name: c.name, description: c.description, requestedBy: c.requestedBy?.name ?? null })),
  };
}

export type PublicCategory = { id: string; name: string; slug: string; imageUrl: string | null; count: number };

/** Live categories with their number of published listings — real counts from the database. */
export async function getPublicCategories(): Promise<PublicCategory[]> {
  const [categories, groups] = await Promise.all([
    prisma.category.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, imageUrl: true } }),
    prisma.property.groupBy({
      by: ["categoryId"],
      where: { status: "PUBLISHED", owner: { status: "ACTIVE" }, categoryId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const counts = new Map(groups.map((g) => [g.categoryId, g._count._all]));
  return categories.map((category) => ({ ...category, count: counts.get(category.id) ?? 0 }));
}

/** For category tiles: categories without their own image borrow a photo from one of their listings. */
export async function withFallbackImages(categories: PublicCategory[]): Promise<PublicCategory[]> {
  return Promise.all(
    categories.map(async (category) => {
      if (category.imageUrl) return category;
      const sample = await prisma.propertyImage.findFirst({
        where: { property: { categoryId: category.id, status: "PUBLISHED" } },
        orderBy: { position: "asc" },
        select: { url: true },
      });
      return { ...category, imageUrl: sample?.url ?? null };
    }),
  );
}
