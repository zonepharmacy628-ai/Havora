import Image from "next/image";
import Link from "next/link";
import { Building2, Eye, Pencil, Plus } from "lucide-react";
import { EmptyState, ListingBadge, Notice, PageHeader, Rating } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { HOST_ROLES } from "@/lib/booking-rules";
import { requireRole } from "@/lib/session";

export default async function OwnerPropertiesPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await requireRole(HOST_ROLES, "/owner/properties");
  const { deleted } = await searchParams;
  const properties = await prisma.property.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { images: { orderBy: { position: "asc" }, take: 1 }, _count: { select: { bookings: true, images: true } } },
  });

  return (
    <>
      <PageHeader
        title="My Properties"
        subtitle="Create, edit and publish your listings."
        action={
          <Link href="/owner/properties/new" className="btn btn-gold">
            <Plus className="size-4" aria-hidden="true" /> Add a Property
          </Link>
        }
      />
      {deleted === "1" && (
        <div className="mb-5">
          <Notice tone="success">The listing has been deleted.</Notice>
        </div>
      )}
      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="You have no listings yet"
          text="Add your property details, upload photos and submit it for review to start welcoming guests."
          action={
            <Link href="/owner/properties/new" className="btn btn-gold">
              Add your first property
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {properties.map((property) => (
            <li key={property.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="relative aspect-[16/10] shrink-0 overflow-hidden rounded-xl bg-cream-200 sm:aspect-[4/3] sm:w-44">
                {property.images[0] ? (
                  <Image src={property.images[0].url} alt="" fill sizes="176px" className="object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-muted">No photos</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-serif text-lg font-medium text-ink">{property.title}</h2>
                  <ListingBadge status={property.status} />
                </div>
                <p className="mt-0.5 text-[13px] text-muted">
                  {property.city}, {property.country} · {formatMoney(property.nightlyPriceCents, property.currency)} / night · sleeps {property.maxGuests}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  <Rating value={property.ratingAvg} count={property.ratingCount} />
                  <span>{property._count.bookings} booking{property._count.bookings === 1 ? "" : "s"}</span>
                  <span>{property._count.images} photo{property._count.images === 1 ? "" : "s"}</span>
                </div>
                {property.status === "REJECTED" && property.rejectionReason && (
                  <p className="mt-2 text-xs font-medium text-red-700">Reviewer feedback: {property.rejectionReason}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href={`/properties/${property.slug}`} className="btn btn-outline btn-sm">
                  <Eye className="size-3.5" aria-hidden="true" /> {property.status === "PUBLISHED" ? "View" : "Preview"}
                </Link>
                <Link href={`/owner/properties/${property.id}`} className="btn btn-navy btn-sm">
                  <Pencil className="size-3.5" aria-hidden="true" /> Manage
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
