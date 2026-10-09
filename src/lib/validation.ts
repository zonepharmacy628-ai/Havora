import { z } from "zod";
import { isIsoDate, isValidTimezone } from "./dates";
import { parseMoneyToCents } from "./money";

export type FormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export const initialFormState: FormState = { ok: false };

/** Flattens a Zod error into `{ field: firstMessage }`. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function invalid(error: z.ZodError): FormState {
  return { ok: false, message: "Please correct the highlighted fields.", errors: fieldErrors(error) };
}

const text = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(min, min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters.`)
    .optional()
    .transform((value) => value || undefined);

const email = z
  .string({ error: "Email is required." })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254));

const isoDate = z.string().refine(isIsoDate, "Enter a valid date.");

const intInRange = (min: number, max: number, label: string) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} must be at least ${min}.`)
    .max(max, `${label} must be at most ${max}.`);

const moneyCents = (label: string, { min, max }: { min: number; max: number }) =>
  z
    .string({ error: `${label} is required.` })
    .transform((value, ctx) => {
      const cents = parseMoneyToCents(value);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `${label} must be an amount like 185 or 185.50.` });
        return z.NEVER;
      }
      return cents;
    })
    .refine((cents) => cents >= min && cents <= max, `${label} is out of the allowed range.`);

// Unchecked checkboxes are simply absent from the submitted form data.
const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on" || value === "true");

const phone = z
  .string({ error: "Phone number is required." })
  .trim()
  .regex(/^\+?[0-9 ()\-.]{7,20}$/, "Enter a valid phone number, e.g. +1 234 567 8900.");

// ───────────────────────────── Auth ─────────────────────────────

export const passwordSchema = z
  .string({ error: "Password is required." })
  .min(10, "Password must be at least 10 characters.")
  .max(128, "Password must be at most 128 characters.");

export const loginSchema = z.object({
  email,
  password: z.string({ error: "Password is required." }).min(1, "Password is required.").max(128),
});

export const registerSchema = z.object({
  name: text(2, 80, "Full name"),
  email,
  password: passwordSchema,
  accountType: z.enum(["CUSTOMER", "OWNER"], { error: "Choose an account type." }),
  terms: z.literal("on", { error: "You must accept the Terms and Privacy Policy." }),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "This reset link is invalid."),
  password: passwordSchema,
});

export const profileSchema = z.object({
  name: text(2, 80, "Full name"),
  phone: z.union([z.literal(""), phone]).optional().transform((v) => v || undefined),
  country: optionalText(60),
  bio: optionalText(600),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});

// ─────────────────────────── Bookings ───────────────────────────

export const staySchema = z.object({
  checkIn: isoDate,
  checkOut: isoDate,
  adults: intInRange(1, 30, "Adults"),
  children: intInRange(0, 30, "Children"),
});

export const bookingSchema = staySchema.extend({
  propertyId: z.string().min(1).max(40),
  paymentMethod: z.enum(["PAY_AT_PROPERTY", "ONLINE"], { error: "Choose a booking method." }),
  contactName: text(2, 80, "Full name"),
  contactEmail: email,
  contactPhone: phone,
  specialRequests: optionalText(1000),
  additionalGuests: optionalText(1000),
});

export const reasonSchema = z.object({
  reason: optionalText(500),
});

export const reviewSchema = z.object({
  bookingId: z.string().min(1).max(40),
  rating: intInRange(1, 5, "Rating"),
  comment: text(10, 2000, "Review"),
});

// ────────────────────────── Properties ──────────────────────────

export const propertySchema = z
  .object({
    title: text(8, 90, "Title"),
    summary: text(20, 160, "Short summary"),
    description: text(80, 5000, "Description"),
    type: z.enum(["VILLA", "APARTMENT", "HOTEL", "BEACH_HOUSE", "CABIN", "RESORT"], { error: "Choose a property type." }),
    addressLine: text(4, 160, "Address"),
    city: text(2, 80, "City"),
    region: optionalText(80),
    country: text(2, 80, "Country"),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Use a 2-letter country code, e.g. ID."),
    postalCode: optionalText(20),
    timezone: z.string().trim().refine(isValidTimezone, "Enter a valid IANA timezone, e.g. Asia/Makassar."),
    nightlyPrice: moneyCents("Nightly price", { min: 1000, max: 10_000_000 }),
    cleaningFee: moneyCents("Cleaning fee", { min: 0, max: 1_000_000 }),
    maxGuests: intInRange(1, 30, "Guests"),
    bedrooms: intInRange(0, 30, "Bedrooms"),
    beds: intInRange(1, 60, "Beds"),
    bathrooms: intInRange(0, 30, "Bathrooms"),
    sleepingArrangements: optionalText(1000),
    houseRules: optionalText(2000),
    checkInFrom: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, e.g. 15:00."),
    checkOutBy: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, e.g. 11:00."),
    minNights: intInRange(1, 90, "Minimum nights"),
    maxNights: intInRange(1, 365, "Maximum nights"),
    cancellationPolicy: z.enum(["FLEXIBLE", "MODERATE", "STRICT"]),
    instantBook: checkbox,
    payAtPropertyEnabled: checkbox,
  })
  .refine((data) => data.maxNights >= data.minNights, {
    path: ["maxNights"],
    message: "Maximum nights must be at least the minimum nights.",
  });

export const blockSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    reason: optionalText(120),
  })
  .refine((data) => data.endDate > data.startDate, { path: ["endDate"], message: "End date must be after the start date." });

export const imageUrlSchema = z.object({
  url: z.url("Enter a valid image URL.").max(600),
  alt: optionalText(140),
});

// ───────────────────────── Admin & misc ─────────────────────────

export const settingsSchema = z.object({
  commissionRate: z.coerce.number({ error: "Enter a percentage." }).min(0, "Minimum 0%.").max(50, "Maximum 50%."),
  serviceFeeRate: z.coerce.number({ error: "Enter a percentage." }).min(0, "Minimum 0%.").max(30, "Maximum 30%."),
  requireListingApproval: checkbox,
  supportEmail: email,
  announcement: optionalText(200),
});

export const contactSchema = z.object({
  name: text(2, 80, "Name"),
  email,
  subject: text(3, 120, "Subject"),
  message: text(10, 3000, "Message"),
});

export const newsletterSchema = z.object({ email });

/** Sleeping arrangements are entered one per line as "Room: beds". */
export function parseSleepingArrangements(input?: string): { room: string; beds: string }[] {
  return (input ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((line) => {
      const [room, ...rest] = line.split(":");
      return rest.length ? { room: room.trim(), beds: rest.join(":").trim() } : { room: "Bedroom", beds: room.trim() };
    });
}

export function parseLines(input?: string, max = 20): string[] {
  return (input ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
