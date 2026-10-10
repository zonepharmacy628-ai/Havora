import type { CategoryStatus, Role } from "@prisma/client";

// Who may do what with property categories. Enforced in the server actions;
// the form only mirrors these rules.

/** Turns a category name into its URL slug ("Tree House" → "tree-house"). */
export function categorySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Tidies a typed category name: trimmed, single spaces. */
export function normaliseCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * The status a new category gets:
 *  - an administrator creates a global category that is live immediately;
 *  - a property owner can only submit a request, which waits for approval;
 *  - nobody else can create categories at all.
 */
export function initialCategoryStatus(role: Role): "ACTIVE" | "PENDING" | null {
  if (role === "ADMIN") return "ACTIVE";
  if (role === "OWNER") return "PENDING";
  return null;
}

/** Only administrators approve or reject category requests. */
export function canReviewCategories(role: Role): boolean {
  return role === "ADMIN";
}

/** A listing may only use a category that is live. */
export function isSelectableCategory(category: { status: CategoryStatus } | null | undefined): boolean {
  return category?.status === "ACTIVE";
}

/** Most open (pending) category requests one owner may have at a time. */
export const MAX_PENDING_CATEGORY_REQUESTS = 3;
