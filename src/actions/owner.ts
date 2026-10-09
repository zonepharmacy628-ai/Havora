"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safely } from "@/lib/action-utils";
import { audit } from "@/lib/audit";
import { ACTIVE_BOOKING_STATUSES, canManageProperty } from "@/lib/booking-rules";
import { cloudinaryConfigured, createUploadSignature, destroyAsset, isOwnCloudinaryUrl } from "@/lib/cloudinary";
import { ALLOWED_IMAGE_HOSTS } from "@/lib/constants";
import { parseDate } from "@/lib/dates";
import { uniqueSlug } from "@/lib/properties";
import { assertRole, AuthorizationError } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import {
  blockSchema,
  formToObject,
  imageUrlSchema,
  invalid,
  parseLines,
  parseSleepingArrangements,
  propertySchema,
  type FormState,
} from "@/lib/validation";

const MAX_IMAGES = 20;
const MIN_IMAGES_TO_PUBLISH = 3;

/**
 * Loads a property the signed-in owner (or an administrator) may manage.
 * Ownership is always checked here on the server — never inferred from the URL.
 */
async function loadManagedProperty(propertyId: unknown) {
  const user = await assertRole(["OWNER", "ADMIN"]);
  if (typeof propertyId !== "string" || !propertyId) throw new AuthorizationError("Property not found.");
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property || !canManageProperty(user, property)) throw new AuthorizationError("Property not found.");
  return { user, property };
}

export async function savePropertyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const propertyId = formData.get("propertyId");
    const existing = propertyId ? await loadManagedProperty(propertyId) : null;
    const user = existing?.user ?? (await assertRole(["OWNER"]));

    const parsed = propertySchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { nightlyPrice, cleaningFee, sleepingArrangements, houseRules, region, postalCode, ...rest } = parsed.data;

    const amenityKeys = formData.getAll("amenities").filter((v): v is string => typeof v === "string").slice(0, 40);
    const amenities = await prisma.amenity.findMany({ where: { key: { in: amenityKeys } }, select: { id: true } });

    const data = {
      ...rest,
      region: region ?? null,
      postalCode: postalCode ?? null,
      nightlyPriceCents: nightlyPrice,
      cleaningFeeCents: cleaningFee,
      sleepingArrangements: parseSleepingArrangements(sleepingArrangements),
      houseRules: parseLines(houseRules),
    };

    if (existing) {
      await prisma.$transaction([
        prisma.propertyAmenity.deleteMany({ where: { propertyId: existing.property.id } }),
        prisma.property.update({
          where: { id: existing.property.id },
          data: { ...data, amenities: { create: amenities.map((a) => ({ amenityId: a.id })) } },
        }),
      ]);
      await audit({ actorId: user.id, action: "property.updated", entityType: "Property", entityId: existing.property.id });
      revalidatePath("/", "layout");
      return { ok: true, message: "Your changes have been saved." };
    }

    const property = await prisma.property.create({
      data: {
        ...data,
        ownerId: user.id,
        slug: await uniqueSlug(data.title),
        status: "DRAFT",
        amenities: { create: amenities.map((a) => ({ amenityId: a.id })) },
      },
    });
    await audit({ actorId: user.id, action: "property.created", entityType: "Property", entityId: property.id });
    revalidatePath("/", "layout");
    redirect(`/owner/properties/${property.id}?created=1#photos`);
  });
}

/** Owner changes to the publication state of a listing. */
export async function listingStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const { user, property } = await loadManagedProperty(formData.get("propertyId"));
    const intent = String(formData.get("intent"));

    if (intent === "submit") {
      if (!["DRAFT", "REJECTED"].includes(property.status)) return { ok: false, message: "This listing has already been submitted." };
      const imageCount = await prisma.propertyImage.count({ where: { propertyId: property.id } });
      if (imageCount < MIN_IMAGES_TO_PUBLISH) {
        return { ok: false, message: `Add at least ${MIN_IMAGES_TO_PUBLISH} photos before submitting your listing.` };
      }
      const { requireListingApproval } = await getSettings();
      const status = requireListingApproval ? "PENDING_REVIEW" : "PUBLISHED";
      await prisma.property.update({
        where: { id: property.id },
        data: { status, rejectionReason: null, publishedAt: status === "PUBLISHED" ? new Date() : property.publishedAt },
      });
      await audit({ actorId: user.id, action: "property.submitted", entityType: "Property", entityId: property.id, metadata: { status } });
      revalidatePath("/", "layout");
      return {
        ok: true,
        message: requireListingApproval ? "Submitted — our team will review your listing shortly." : "Your listing is now live.",
      };
    }

    if (intent === "unlist" && property.status === "PUBLISHED") {
      await prisma.property.update({ where: { id: property.id }, data: { status: "UNLISTED" } });
      await audit({ actorId: user.id, action: "property.unlisted", entityType: "Property", entityId: property.id });
      revalidatePath("/", "layout");
      return { ok: true, message: "Listing paused. It is hidden from search; existing bookings are unaffected." };
    }

    // Only listings that were previously approved (publishedAt set) can be re-listed without review.
    if (intent === "relist" && property.status === "UNLISTED" && property.publishedAt) {
      await prisma.property.update({ where: { id: property.id }, data: { status: "PUBLISHED" } });
      await audit({ actorId: user.id, action: "property.relisted", entityType: "Property", entityId: property.id });
      revalidatePath("/", "layout");
      return { ok: true, message: "Your listing is live again." };
    }

    return { ok: false, message: "That action is not available for this listing." };
  });
}

export async function deletePropertyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const { user, property } = await loadManagedProperty(formData.get("propertyId"));
    const bookings = await prisma.booking.count({ where: { propertyId: property.id } });
    if (bookings > 0) {
      return { ok: false, message: "Listings with booking history cannot be deleted. Pause the listing instead." };
    }
    const images = await prisma.propertyImage.findMany({ where: { propertyId: property.id }, select: { publicId: true } });
    await prisma.property.delete({ where: { id: property.id } });
    await Promise.all(images.filter((i) => i.publicId).map((i) => destroyAsset(i.publicId!)));
    await audit({ actorId: user.id, action: "property.deleted", entityType: "Property", entityId: property.id, metadata: { title: property.title } });
    revalidatePath("/", "layout");
    redirect("/owner/properties?deleted=1");
  });
}

// ───────────────────────────── Photos ─────────────────────────────

async function nextImagePosition(propertyId: string): Promise<number | null> {
  const images = await prisma.propertyImage.findMany({ where: { propertyId }, select: { position: true } });
  if (images.length >= MAX_IMAGES) return null;
  return images.reduce((max, image) => Math.max(max, image.position), -1) + 1;
}

export async function addImageByUrlAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const { property } = await loadManagedProperty(formData.get("propertyId"));
    const parsed = imageUrlSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);

    const url = new URL(parsed.data.url);
    if (url.protocol !== "https:" || !ALLOWED_IMAGE_HOSTS.includes(url.hostname)) {
      return { ok: false, message: `Photos can be linked from: ${ALLOWED_IMAGE_HOSTS.join(", ")}.`, errors: { url: "This image host is not supported." } };
    }
    const position = await nextImagePosition(property.id);
    if (position === null) return { ok: false, message: `A listing can have up to ${MAX_IMAGES} photos.` };

    await prisma.propertyImage.create({
      data: { propertyId: property.id, url: `${url.origin}${url.pathname}`, alt: parsed.data.alt ?? property.title, position },
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Photo added." };
  });
}

export type UploadSignature = ReturnType<typeof createUploadSignature>;

export async function getUploadSignatureAction(propertyId: string): Promise<{ ok: true; data: UploadSignature } | { ok: false; message: string }> {
  try {
    const { property } = await loadManagedProperty(propertyId);
    if (!cloudinaryConfigured()) return { ok: false, message: "Photo uploads are not configured yet." };
    if ((await nextImagePosition(property.id)) === null) return { ok: false, message: `A listing can have up to ${MAX_IMAGES} photos.` };
    return { ok: true, data: createUploadSignature(property.id) };
  } catch {
    return { ok: false, message: "You do not have permission to upload photos here." };
  }
}

export async function registerUploadedImageAction(propertyId: string, url: string, publicId: string): Promise<FormState> {
  return safely(async () => {
    const { property } = await loadManagedProperty(propertyId);
    if (typeof url !== "string" || typeof publicId !== "string" || !isOwnCloudinaryUrl(url, property.id)) {
      return { ok: false, message: "That upload could not be verified." };
    }
    const position = await nextImagePosition(property.id);
    if (position === null) return { ok: false, message: `A listing can have up to ${MAX_IMAGES} photos.` };
    await prisma.propertyImage.create({ data: { propertyId: property.id, url, publicId: publicId.slice(0, 200), alt: property.title, position } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Photo uploaded." };
  });
}

export async function imageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const { property } = await loadManagedProperty(formData.get("propertyId"));
    const imageId = String(formData.get("imageId"));
    const intent = String(formData.get("intent"));

    const images = await prisma.propertyImage.findMany({ where: { propertyId: property.id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
    const index = images.findIndex((image) => image.id === imageId);
    if (index === -1) return { ok: false, message: "Photo not found." };

    if (intent === "delete") {
      const [removed] = images.splice(index, 1);
      await prisma.propertyImage.delete({ where: { id: removed.id } });
      if (removed.publicId) await destroyAsset(removed.publicId);
    } else {
      const target = intent === "up" ? index - 1 : intent === "down" ? index + 1 : intent === "cover" ? 0 : -1;
      if (target < 0 || target >= images.length) return { ok: false, message: "That photo cannot be moved further." };
      const [moved] = images.splice(index, 1);
      images.splice(target, 0, moved);
    }

    await prisma.$transaction(images.map((image, position) => prisma.propertyImage.update({ where: { id: image.id }, data: { position } })));
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

// ────────────────────────── Availability ──────────────────────────

export async function addBlockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const { property } = await loadManagedProperty(formData.get("propertyId"));
    const parsed = blockSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    const start = parseDate(parsed.data.startDate);
    const end = parseDate(parsed.data.endDate);

    const clash = await prisma.booking.findFirst({
      where: { propertyId: property.id, status: { in: ACTIVE_BOOKING_STATUSES }, checkIn: { lt: end }, checkOut: { gt: start } },
      select: { reference: true },
    });
    if (clash) return { ok: false, message: `Those dates overlap booking ${clash.reference}. Cancel the booking first or choose other dates.` };

    await prisma.availabilityBlock.create({ data: { propertyId: property.id, startDate: start, endDate: end, reason: parsed.data.reason ?? null } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Dates blocked." };
  });
}

export async function deleteBlockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const { property } = await loadManagedProperty(formData.get("propertyId"));
    // Scoped to the verified property so a block id from another listing cannot be removed.
    await prisma.availabilityBlock.deleteMany({ where: { id: String(formData.get("blockId")), propertyId: property.id } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Dates reopened." };
  });
}
