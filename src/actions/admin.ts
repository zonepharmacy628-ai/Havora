"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safely } from "@/lib/action-utils";
import { refreshRating } from "@/lib/reviews";
import { assertRole } from "@/lib/session";
import { SETTING_KEYS } from "@/lib/settings";
import { formToObject, invalid, reasonSchema, settingsSchema, type FormState } from "@/lib/validation";

// Every action here starts with assertRole(["ADMIN"]) and writes an audit log
// entry in the same transaction as the change.

export async function reviewListingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const admin = await assertRole(["ADMIN"]);
    const property = await prisma.property.findUnique({ where: { id: String(formData.get("propertyId")) } });
    if (!property) return { ok: false, message: "Property not found." };
    const decision = String(formData.get("decision"));
    const reason = reasonSchema.safeParse(formToObject(formData));
    const note = reason.success ? reason.data.reason : undefined;

    let data: { status?: "PUBLISHED" | "REJECTED" | "UNLISTED"; rejectionReason?: string | null; publishedAt?: Date; featured?: boolean };
    let message: string;

    if (decision === "approve" && ["PENDING_REVIEW", "REJECTED", "UNLISTED"].includes(property.status)) {
      data = { status: "PUBLISHED", rejectionReason: null, publishedAt: property.publishedAt ?? new Date() };
      message = "Listing approved and published.";
    } else if (decision === "reject" && property.status === "PENDING_REVIEW") {
      if (!note) return { ok: false, message: "Please give the owner a reason for the rejection.", errors: { reason: "A reason is required." } };
      data = { status: "REJECTED", rejectionReason: note };
      message = "Listing rejected. The owner can see your reason and resubmit.";
    } else if (decision === "unpublish" && property.status === "PUBLISHED") {
      data = { status: "UNLISTED", featured: false };
      message = "Listing removed from search.";
    } else if (decision === "feature" && property.status === "PUBLISHED") {
      data = { featured: !property.featured };
      message = property.featured ? "Removed from featured stays." : "Added to featured stays.";
    } else {
      return { ok: false, message: "That action is not available for this listing." };
    }

    await prisma.$transaction([
      prisma.property.update({ where: { id: property.id }, data }),
      prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: `listing.${decision}`,
          entityType: "Property",
          entityId: property.id,
          metadata: { title: property.title, from: property.status, reason: note ?? null },
        },
      }),
    ]);
    revalidatePath("/", "layout");
    return { ok: true, message };
  });
}

export async function setUserStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const admin = await assertRole(["ADMIN"]);
    const target = await prisma.user.findUnique({ where: { id: String(formData.get("userId")) } });
    if (!target) return { ok: false, message: "User not found." };
    const status = formData.get("status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
    if (target.id === admin.id) return { ok: false, message: "You cannot change the status of your own account." };
    if (target.status === status) return { ok: true };

    await prisma.$transaction([
      prisma.user.update({ where: { id: target.id }, data: { status } }),
      // Suspension signs the user out everywhere immediately.
      ...(status === "SUSPENDED" ? [prisma.session.deleteMany({ where: { userId: target.id } })] : []),
      prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: status === "SUSPENDED" ? "user.suspended" : "user.reactivated",
          entityType: "User",
          entityId: target.id,
          metadata: { email: target.email },
        },
      }),
    ]);
    revalidatePath("/", "layout");
    return { ok: true, message: status === "SUSPENDED" ? "Account suspended and signed out." : "Account reactivated." };
  });
}

export async function setUserRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const admin = await assertRole(["ADMIN"]);
    const target = await prisma.user.findUnique({ where: { id: String(formData.get("userId")) } });
    if (!target) return { ok: false, message: "User not found." };
    const role = String(formData.get("role"));
    if (role !== "CUSTOMER" && role !== "OWNER" && role !== "ADMIN") return { ok: false, message: "Unknown role." };
    if (target.id === admin.id) return { ok: false, message: "You cannot change your own role." };
    if (target.role === role) return { ok: true };
    if (target.role === "OWNER" && (await prisma.property.count({ where: { ownerId: target.id } })) > 0) {
      return { ok: false, message: "This owner still has listings. Remove or reassign them before changing the role." };
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: target.id }, data: { role } }),
      prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: "user.role_changed",
          entityType: "User",
          entityId: target.id,
          metadata: { email: target.email, from: target.role, to: role },
        },
      }),
    ]);
    revalidatePath("/", "layout");
    return { ok: true, message: "Role updated." };
  });
}

export async function moderateReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const admin = await assertRole(["ADMIN"]);
    const review = await prisma.review.findUnique({ where: { id: String(formData.get("reviewId")) } });
    if (!review) return { ok: false, message: "Review not found." };
    const status = formData.get("status") === "HIDDEN" ? "HIDDEN" : "PUBLISHED";

    await prisma.$transaction(async (tx) => {
      await tx.review.update({ where: { id: review.id }, data: { status } });
      await refreshRating(tx, review.propertyId);
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: status === "HIDDEN" ? "review.hidden" : "review.restored",
          entityType: "Review",
          entityId: review.id,
        },
      });
    });
    revalidatePath("/", "layout");
    return { ok: true, message: status === "HIDDEN" ? "Review hidden from the public site." : "Review restored." };
  });
}

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const admin = await assertRole(["ADMIN"]);
    const parsed = settingsSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const values: Record<string, string> = {
      [SETTING_KEYS.commissionRateBps]: String(Math.round(parsed.data.commissionRate * 100)),
      [SETTING_KEYS.serviceFeeRateBps]: String(Math.round(parsed.data.serviceFeeRate * 100)),
      [SETTING_KEYS.requireListingApproval]: String(parsed.data.requireListingApproval),
      [SETTING_KEYS.supportEmail]: parsed.data.supportEmail,
      [SETTING_KEYS.announcement]: parsed.data.announcement ?? "",
    };

    await prisma.$transaction([
      ...Object.entries(values).map(([key, value]) =>
        prisma.platformSetting.upsert({ where: { key }, update: { value }, create: { key, value } }),
      ),
      prisma.auditLog.create({
        data: { actorId: admin.id, action: "settings.updated", entityType: "PlatformSetting", metadata: values },
      }),
    ]);
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved. New rates apply to future bookings only." };
  });
}

export async function resolveMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const admin = await assertRole(["ADMIN"]);
    const id = String(formData.get("messageId"));
    const status = formData.get("status") === "NEW" ? "NEW" : "RESOLVED";
    await prisma.$transaction([
      prisma.contactMessage.update({ where: { id }, data: { status } }),
      prisma.auditLog.create({
        data: { actorId: admin.id, action: `message.${status.toLowerCase()}`, entityType: "ContactMessage", entityId: id },
      }),
    ]);
    revalidatePath("/admin/messages");
    return { ok: true };
  });
}
