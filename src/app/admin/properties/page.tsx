import Image from "next/image";
import Link from "next/link";
import type { ListingStatus } from "@prisma/client";
import { Building2, Eye, Pencil, Star } from "lucide-react";
import { reviewListingAction } from "@/actions/admin";
import { StatusTabs } from "@/components/booking-list";
import { ActionForm, SubmitButton, TextField } from "@/components/forms";
import { EmptyState, ListingBadge, PageHeader } from "@/components/ui";
import { LISTING_STATUS_LABEL, propertyTypeLabel } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

const STATUSES: ListingStatus[] = ["PENDING_REVIEW", "PUBLISHED", "REJECTED", "UNLISTED", "DRAFT"];

export default async function AdminPropertiesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole(["ADMIN"], "/admin/properties");
  const { status = "" } = await searchParams;
  const current = STATUSES.includes(status as ListingStatus) ? (status as ListingStatus) : null;

  const [properties, groups] = await Promise.all([
    prisma.property.findMany({
      where: current ? { status: current } : {},
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        owner: { select: { name: true, email: true } },
        _count: { select: { images: true, bookings: true } },
      },
    }),
    prisma.property.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const counts = new Map(groups.map((g) => [g.status, g._count._all]));
  const total = groups.reduce((sum, g) => sum + g._count._all, 0);

  return (
    <>
      <PageHeader title="Properties" subtitle="Approve or reject new listings, feature the best stays and remove listings from search." />
      <StatusTabs
        base="/admin/properties"
        current={current ?? ""}
        tabs={[{ value: "", label: "All", count: total }, ...STATUSES.map((s) => ({ value: s, label: LISTING_STATUS_LABEL[s], count: counts.get(s) ?? 0 }))]}
      />

      {properties.length === 0 ? (
        <EmptyState icon={Building2} title="No listings here" text="Listings with this status will appear here." />
      ) : (
        <ul className="space-y-4">
          {properties.map((property) => (
            <li key={property.id} className="card p-4">
              <div className="flex flex-col gap-4 sm:flex-row">
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
                    {property.featured && (
                      <span className="badge bg-gold-500 text-navy-950">
                        <Star className="size-3" aria-hidden="true" /> Featured
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {propertyTypeLabel(property.type)} · {property.city}, {property.country} · {formatMoney(property.nightlyPriceCents, property.currency)} / night · sleeps {property.maxGuests}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Owner: <span className="font-medium text-ink">{property.owner.name}</span> ({property.owner.email}) · {property._count.images} photos · {property._count.bookings} bookings · updated {formatDate(property.updatedAt)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{property.summary}</p>
                  {property.rejectionReason && <p className="mt-2 text-xs font-medium text-red-700">Rejection reason: {property.rejectionReason}</p>}
                </div>
                <div className="flex shrink-0 gap-2 sm:flex-col">
                  <Link href={`/properties/${property.slug}`} className="btn btn-outline btn-sm">
                    <Eye className="size-3.5" aria-hidden="true" /> Preview
                  </Link>
                  <Link href={`/owner/properties/${property.id}`} className="btn btn-outline btn-sm">
                    <Pencil className="size-3.5" aria-hidden="true" /> Edit
                  </Link>
                </div>
              </div>

              {property.status !== "DRAFT" && (
                <ActionForm action={reviewListingAction} messagePosition="bottom" className="mt-4 border-t border-cream-200 pt-4">
                  <input type="hidden" name="propertyId" value={property.id} />
                  {property.status === "PENDING_REVIEW" && (
                    <TextField name="reason" label="Feedback for the owner (required to reject)" maxLength={500} placeholder="e.g. Please add clearer photos of the bedrooms." className="mb-3 max-w-xl" />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(property.status === "PENDING_REVIEW" || property.status === "REJECTED" || property.status === "UNLISTED") && (
                      <SubmitButton name="decision" value="approve" className="btn btn-gold btn-sm">
                        Approve &amp; publish
                      </SubmitButton>
                    )}
                    {property.status === "PENDING_REVIEW" && (
                      <SubmitButton name="decision" value="reject" className="btn btn-danger btn-sm">
                        Reject
                      </SubmitButton>
                    )}
                    {property.status === "PUBLISHED" && (
                      <>
                        <SubmitButton name="decision" value="feature" className="btn btn-outline btn-sm">
                          {property.featured ? "Remove from featured" : "Feature on homepage"}
                        </SubmitButton>
                        <SubmitButton name="decision" value="unpublish" className="btn btn-danger btn-sm">
                          Unpublish
                        </SubmitButton>
                      </>
                    )}
                  </div>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
