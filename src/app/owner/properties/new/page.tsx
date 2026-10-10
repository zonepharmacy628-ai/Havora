import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PropertyForm } from "@/components/property-form";
import { PageHeader } from "@/components/ui";
import { getCategoryFormData } from "@/lib/categories";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { HOST_ROLES } from "@/lib/booking-rules";
import { requireRole } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export default async function NewPropertyPage() {
  const user = await requireRole(HOST_ROLES, "/owner/properties/new");
  const [amenities, settings, categories] = await Promise.all([prisma.amenity.findMany({ orderBy: { label: "asc" } }), getSettings(), getCategoryFormData(user)]);

  return (
    <>
      <Link href="/owner/properties" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-gold-700">
        <ArrowLeft className="size-4" aria-hidden="true" /> My properties
      </Link>
      <PageHeader
        title="Add a property"
        subtitle={`Your listing is saved as a draft. After adding photos you can ${settings.requireListingApproval && user.role !== "ADMIN" ? "submit it for review" : "publish it"}.`}
      />
      <PropertyForm amenities={amenities} commissionRateBps={settings.commissionRateBps} categories={categories} isAdmin={user.role === "ADMIN"} uploadsEnabled={cloudinaryConfigured()} />
    </>
  );
}
