"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  canReviewCategories,
  categorySlug,
  initialCategoryStatus,
  MAX_PENDING_CATEGORY_REQUESTS,
  normaliseCategoryName,
} from "@/lib/category-rules";
import { cloudinaryConfigured, createCategoryUploadSignature, destroyAsset, isOwnCategoryImageUrl } from "@/lib/cloudinary";
import { ALLOWED_IMAGE_HOSTS } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { categorySchema, fieldErrors } from "@/lib/validation";

// Categories are created from inside the Add Property form (there is no
// separate category-management page). Permissions are decided here, on the
// server, from the signed-in user's role — never from anything the form sends.

export type CategoryInput = { name: string; description?: string; imageUrl?: string; imagePublicId?: string };

export type CategoryResult =
  | { ok: true; status: "ACTIVE" | "PENDING"; category: { id: string; name: string }; message: string }
  | { ok: false; message: string; errors?: Record<string, string> };

const DENIED: CategoryResult = { ok: false, message: "You do not have permission to create categories." };

export async function createCategoryAction(input: CategoryInput): Promise<CategoryResult> {
  try {
    const user = await getCurrentUser();
    const status = user ? initialCategoryStatus(user.role) : null;
    if (!user || !status) return DENIED;

    const parsed = categorySchema.safeParse(input ?? {});
    if (!parsed.success) return { ok: false, message: "Please correct the highlighted fields.", errors: fieldErrors(parsed.error) };

    const name = normaliseCategoryName(parsed.data.name);
    const slug = categorySlug(name);
    if (slug.length < 2) return { ok: false, message: "Please correct the highlighted fields.", errors: { name: "Use letters or numbers in the category name." } };

    // Duplicates are checked against every category — live, pending and rejected —
    // by name (ignoring letter case) and by slug.
    const existing = await prisma.category.findFirst({
      where: { OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }] },
      select: { status: true, requestedById: true },
    });
    if (existing) {
      const reason =
        existing.status === "ACTIVE"
          ? "A category with this name already exists. Please select it from the list."
          : existing.status === "PENDING"
            ? existing.requestedById === user.id
              ? "You have already requested this category. It is waiting for approval."
              : "This category has already been requested and is waiting for approval."
            : "A category with this name was previously declined. Please contact support if you believe it should be added.";
      return { ok: false, message: reason, errors: { name: "This category name is already in use." } };
    }

    if (status === "PENDING") {
      const open = await prisma.category.count({ where: { requestedById: user.id, status: "PENDING" } });
      if (open >= MAX_PENDING_CATEGORY_REQUESTS) {
        return { ok: false, message: `You already have ${open} category requests waiting for approval. Please wait for a decision before requesting more.` };
      }
      if (!(await rateLimit(`category-request:${user.id}`, 6, 86_400))) {
        return { ok: false, message: "Too many category requests today. Please try again tomorrow." };
      }
    }

    // The image must come from this site's own upload folder or an approved image host.
    let imageUrl: string | null = null;
    let imagePublicId: string | null = null;
    if (parsed.data.imageUrl) {
      let url: URL;
      try {
        url = new URL(parsed.data.imageUrl);
      } catch {
        return { ok: false, message: "Please correct the highlighted fields.", errors: { imageUrl: "Enter a valid image link." } };
      }
      const uploaded = isOwnCategoryImageUrl(parsed.data.imageUrl, user.id);
      if (!uploaded && (url.protocol !== "https:" || !ALLOWED_IMAGE_HOSTS.includes(url.hostname))) {
        return { ok: false, message: `Images can be linked from: ${ALLOWED_IMAGE_HOSTS.join(", ")}.`, errors: { imageUrl: "This image host is not supported." } };
      }
      imageUrl = uploaded ? parsed.data.imageUrl : `${url.origin}${url.pathname}`;
      imagePublicId = uploaded ? (parsed.data.imagePublicId ?? null) : null;
    }

    let category: { id: string; name: string };
    try {
      category = await prisma.$transaction(async (tx) => {
        const created = await tx.category.create({
          data: {
            name,
            slug,
            description: parsed.data.description ?? null,
            imageUrl,
            imagePublicId,
            status,
            requestedById: status === "PENDING" ? user.id : null,
          },
          select: { id: true, name: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: status === "ACTIVE" ? "category.created" : "category.requested",
            entityType: "Category",
            entityId: created.id,
            metadata: { name, slug },
          },
        });
        return created;
      });
    } catch (error) {
      // Unique indexes on name, lower(name) and slug are the final guard against a race.
      if ((error as { code?: string }).code === "P2002" || String((error as Error).message).includes("Category_name_lower_key")) {
        return { ok: false, message: "A category with this name already exists.", errors: { name: "This category name is already in use." } };
      }
      throw error;
    }

    revalidatePath("/", "layout");
    return status === "ACTIVE"
      ? { ok: true, status, category, message: `“${category.name}” was created and selected.` }
      : {
          ok: true,
          status,
          category,
          message: `Your request for “${category.name}” has been sent. It is pending approval by an administrator and will appear in this list once approved. Please choose an existing category for now.`,
        };
  } catch (error) {
    console.error("[category] create failed", error);
    return { ok: false, message: "Something went wrong on our side. Please try again." };
  }
}

export type CategoryReviewResult = { ok: true; approved: boolean; category: { id: string; name: string }; message: string } | { ok: false; message: string };

/** Administrator decision on an owner's category request. */
export async function reviewCategoryRequestAction(categoryId: string, decision: "approve" | "reject", reason?: string): Promise<CategoryReviewResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !canReviewCategories(user.role)) return { ok: false, message: "You do not have permission to review category requests." };
    if (typeof categoryId !== "string" || (decision !== "approve" && decision !== "reject")) return { ok: false, message: "Invalid request." };

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.status !== "PENDING") return { ok: false, message: "This request has already been decided." };

    const approved = decision === "approve";
    const note = typeof reason === "string" ? reason.trim().replace(/\s+/g, " ") : "";
    if (!approved && (note.length < 3 || note.length > 200)) {
      return { ok: false, message: "Please give the owner a short reason for declining (3 to 200 characters)." };
    }
    await prisma.$transaction([
      prisma.category.update({
        where: { id: category.id },
        data: { status: approved ? "ACTIVE" : "REJECTED", rejectionReason: approved ? null : note },
      }),
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: approved ? "category.approved" : "category.rejected",
          entityType: "Category",
          entityId: category.id,
          metadata: { name: category.name, requestedById: category.requestedById, reason: approved ? null : note },
        },
      }),
    ]);
    if (!approved && category.imagePublicId) await destroyAsset(category.imagePublicId);

    revalidatePath("/", "layout");
    return {
      ok: true,
      approved,
      category: { id: category.id, name: category.name },
      message: approved ? `“${category.name}” is now available to all hosts.` : `The request for “${category.name}” was declined.`,
    };
  } catch (error) {
    console.error("[category] review failed", error);
    return { ok: false, message: "Something went wrong on our side. Please try again." };
  }
}

export type CategoryUploadSignature = ReturnType<typeof createCategoryUploadSignature>;

/** Short-lived signature for uploading one category image straight to Cloudinary. */
export async function getCategoryUploadSignatureAction(): Promise<{ ok: true; data: CategoryUploadSignature } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user || !initialCategoryStatus(user.role)) return { ok: false, message: "You do not have permission to upload category images." };
  if (!cloudinaryConfigured()) return { ok: false, message: "Image uploads are not configured yet." };
  if (!(await rateLimit(`category-upload:${user.id}`, 20, 3600))) return { ok: false, message: "Too many uploads. Please try again later." };
  return { ok: true, data: createCategoryUploadSignature(user.id) };
}
