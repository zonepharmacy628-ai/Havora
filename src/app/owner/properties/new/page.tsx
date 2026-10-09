import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PropertyForm } from "@/components/property-form";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export default async function NewPropertyPage() {
  await requireRole(["OWNER"], "/owner/properties/new");
  const [amenities, settings] = await Promise.all([prisma.amenity.findMany({ orderBy: { label: "asc" } }), getSettings()]);

  return (
    <>
      <Link href="/owner/properties" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-gold-700">
        <ArrowLeft className="size-4" aria-hidden="true" /> My properties
      </Link>
      <PageHeader
        title="Add a property"
        subtitle={`Your listing is saved as a draft. After adding photos you can submit it${settings.requireListingApproval ? " for review" : ""}.`}
      />
      <PropertyForm amenities={amenities} commissionRateBps={settings.commissionRateBps} />
    </>
  );
}
