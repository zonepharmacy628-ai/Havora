"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { safely, TOO_MANY } from "@/lib/action-utils";
import { rateLimitByIp } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { contactSchema, formToObject, invalid, newsletterSchema, type FormState } from "@/lib/validation";

export type WishlistResult = { ok: boolean; saved: boolean; needsLogin?: boolean };

export async function toggleWishlistAction(propertyId: string): Promise<WishlistResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, saved: false, needsLogin: true };
  if (typeof propertyId !== "string" || propertyId.length > 40) return { ok: false, saved: false };

  const property = await prisma.property.findFirst({ where: { id: propertyId, status: "PUBLISHED" }, select: { id: true } });
  const key = { userId_propertyId: { userId: user.id, propertyId } };
  const existing = await prisma.wishlist.findUnique({ where: key });

  if (existing) {
    await prisma.wishlist.delete({ where: key });
    revalidatePath("/account/wishlist");
    return { ok: true, saved: false };
  }
  if (!property) return { ok: false, saved: false };
  await prisma.wishlist.create({ data: { userId: user.id, propertyId } });
  revalidatePath("/account/wishlist");
  return { ok: true, saved: true };
}

export async function contactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const parsed = contactSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    if (!(await rateLimitByIp("contact", 5, 3600))) return TOO_MANY;
    await prisma.contactMessage.create({ data: parsed.data });
    return { ok: true, message: "Thank you — your message has been received. Our team will reply by email." };
  });
}

export async function newsletterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const parsed = newsletterSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, message: "Enter a valid email address." };
    if (!(await rateLimitByIp("newsletter", 5, 3600))) return TOO_MANY;
    await prisma.newsletterSubscriber.upsert({
      where: { email: parsed.data.email },
      update: {},
      create: { email: parsed.data.email },
    });
    return { ok: true, message: "You're on the list. Thank you for subscribing." };
  });
}
