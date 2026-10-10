"use server";

import { prisma } from "@/lib/prisma";
import { safely, TOO_MANY } from "@/lib/action-utils";
import { rateLimitByIp } from "@/lib/rate-limit";
import { cardSelect, type PropertyCardData } from "@/lib/properties";
import { contactSchema, formToObject, invalid, newsletterSchema, type FormState } from "@/lib/validation";

/**
 * Card data for the browser wishlist. Only ids are sent by the client; anything
 * that is not a currently published listing is simply left out.
 */
export async function getWishlistPropertiesAction(ids: string[]): Promise<PropertyCardData[]> {
  if (!Array.isArray(ids)) return [];
  const clean = [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 40))].slice(0, 100);
  if (clean.length === 0) return [];
  const found = await prisma.property.findMany({
    where: { id: { in: clean }, status: "PUBLISHED", owner: { status: "ACTIVE" } },
    select: cardSelect,
  });
  const order = new Map(clean.map((id, index) => [id, index]));
  return found.sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));
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
