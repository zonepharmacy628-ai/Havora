import type {
  BookingStatus,
  CancellationPolicy,
  ListingStatus,
  PaymentMethod,
  PaymentStatus,
  PropertyType,
  Role,
} from "@prisma/client";

export const SITE_NAME = "HAVORA";
export const SITE_TAGLINE = "Stays · Homes · Experiences";

export const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}`;

export const HERO_IMAGE = unsplash("1571896349842-33c89424de2d");
export const AUTH_IMAGE = unsplash("1551882547-ff40c63fe5fa");
export const HOST_IMAGE = unsplash("1613490493576-7fde63acd811");
export const ABOUT_IMAGE = unsplash("1582719508461-905c673771fd");

export const PROPERTY_TYPES: { value: PropertyType; label: string; plural: string; image: string }[] = [
  { value: "VILLA", label: "Villa", plural: "Villas", image: unsplash("1613977257363-707ba9348227") },
  { value: "APARTMENT", label: "Apartment", plural: "Apartments", image: unsplash("1502672260266-1c1ef2d93688") },
  { value: "HOTEL", label: "Hotel", plural: "Hotels", image: unsplash("1566073771259-6a8506099945") },
  { value: "BEACH_HOUSE", label: "Beach house", plural: "Beach houses", image: unsplash("1499793983690-e29da59ef1c2") },
  { value: "CABIN", label: "Cabin", plural: "Cabins", image: unsplash("1510798831971-661eb04b3739") },
  { value: "RESORT", label: "Resort", plural: "Resorts", image: unsplash("1520250497591-112f2f40a3f4") },
];

export const propertyTypeLabel = (type: PropertyType) =>
  PROPERTY_TYPES.find((t) => t.value === type)?.label ?? type;

/** Destination artwork for well-known cities; other cities fall back to a listing photo. */
export const DESTINATION_IMAGES: Record<string, string> = {
  bali: unsplash("1537996194471-e657df975ab4"),
  santorini: unsplash("1570077188670-e3a8d69ac5ff"),
  dubai: unsplash("1512453979798-5ea266f8880c"),
  maldives: unsplash("1514282401047-d79a71a590e8"),
  paris: unsplash("1502602898657-3e91760cbb34"),
};

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
  UNLISTED: "Unlisted",
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "Awaiting host",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined",
  CANCELLATION_REQUESTED: "Cancellation requested",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  NO_SHOW: "No-show",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid — due at property",
  PAID: "Paid",
  REFUNDED: "Refunded",
  VOID: "Void",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  PAY_AT_PROPERTY: "Pay at property",
  ONLINE: "Online payment",
};

export const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: "Customer",
  OWNER: "Property owner",
  ADMIN: "Administrator",
};

export const CANCELLATION_POLICIES: Record<CancellationPolicy, { label: string; freeDays: number; summary: string }> = {
  FLEXIBLE: {
    label: "Flexible",
    freeDays: 1,
    summary: "Cancel free of charge up to 1 day before check-in.",
  },
  MODERATE: {
    label: "Moderate",
    freeDays: 5,
    summary: "Cancel free of charge up to 5 days before check-in.",
  },
  STRICT: {
    label: "Strict",
    freeDays: 14,
    summary: "Cancel free of charge up to 14 days before check-in.",
  },
};

export const SORT_OPTIONS = [
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Top rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const PAGE_SIZE = 9;

/** Hosts owners may link photos from when adding an image by URL. */
export const ALLOWED_IMAGE_HOSTS = ["images.unsplash.com", "res.cloudinary.com"];
