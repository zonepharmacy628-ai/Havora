import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { addBlockAction, deleteBlockAction, deletePropertyAction, listingStatusAction } from "@/actions/owner";
import { ActionForm, SubmitButton, TextField } from "@/components/forms";
import { PhotoManager } from "@/components/photo-manager";
import { PropertyForm } from "@/components/property-form";
import { ListingBadge, Notice } from "@/components/ui";
import { canManageProperty, HOST_ROLES } from "@/lib/booking-rules";
import { getUnavailableRanges } from "@/lib/bookings";
import { getCategoryFormData } from "@/lib/categories";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { addDays, formatDateRange, toIso, todayIn } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getSettings } from "@/lib/settings";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function MonthView({ year, month, kindOf, today }: { year: number; month: number; kindOf: (date: string) => "booked" | "blocked" | null; today: string }) {
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return (
    <div>
      <p className="mb-2 text-center text-sm font-semibold text-ink">
        {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month, 1)))}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[12px]">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-[10px] font-medium text-muted">{day}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = toIso(new Date(Date.UTC(year, month, i + 1)));
          const kind = kindOf(date);
          const tone =
            kind === "booked" ? "bg-navy-800 text-gold-300" : kind === "blocked" ? "bg-cream-300 text-muted line-through" : date < today ? "text-navy-200" : "bg-emerald-50 text-emerald-800";
          return (
            <span key={date} title={kind ?? (date < today ? "past" : "available")} className={`flex aspect-square items-center justify-center rounded-md ${tone} ${date === today ? "ring-1 ring-gold-500" : ""}`}>
              {i + 1}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default async function ManagePropertyPage({ params, searchParams }: Props) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const user = await requireRole(HOST_ROLES, `/owner/properties/${id}`);

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      amenities: { select: { amenityId: true } },
      images: { orderBy: { position: "asc" } },
      blocks: { orderBy: { startDate: "asc" } },
      _count: { select: { bookings: true } },
    },
  });
  // Changing the id in the URL to someone else's listing yields a 404, not their data.
  if (!property || !canManageProperty(user, property)) notFound();

  const today = todayIn(property.timezone);
  const [amenities, settings, categories, ranges] = await Promise.all([
    prisma.amenity.findMany({ orderBy: { label: "asc" } }),
    getSettings(),
    getCategoryFormData(user),
    getUnavailableRanges(prisma, property.id, today),
  ]);
  const kindOf = (date: string) => ranges.find((range) => date >= range.start && date < range.end)?.kind ?? null;
  const base = new Date(`${today}T00:00:00Z`);
  const months = [0, 1, 2].map((offset) => {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const upcomingBlocks = property.blocks.filter((block) => toIso(block.endDate) > today);
  const { status } = property;
  const isOwnListing = property.ownerId === user.id;
  // Owners follow the listing-approval setting; an administrator publishes directly.
  const isAdmin = user.role === "ADMIN";
  const reviewRequired = settings.requireListingApproval && !isAdmin;

  return (
    <>
      <Link href={isOwnListing ? "/owner/properties" : "/admin/properties"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-gold-700">
        <ArrowLeft className="size-4" aria-hidden="true" /> {isOwnListing ? "My properties" : "All listings"}
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="heading-serif text-3xl">{property.title}</h1>
          <ListingBadge status={status} />
        </div>
        <Link href={`/properties/${property.slug}`} className="btn btn-outline btn-sm">
          <Eye className="size-3.5" aria-hidden="true" /> {status === "PUBLISHED" ? "View listing" : "Preview"}
        </Link>
      </div>

      {created === "1" && (
        <div className="mb-6">
          <Notice tone="success">Draft saved. Next, add at least 3 photos below, then submit your listing.</Notice>
        </div>
      )}

      {/* ───── Publication ───── */}
      <section className="card card-pad mb-8">
        <h2 className="font-serif text-lg font-medium text-ink">Publication status</h2>
        <p className="mt-1 text-sm text-muted">
          {status === "DRAFT" && `This listing is a draft and is not visible to guests. ${reviewRequired ? "Submit it for review when it is ready." : "Publish it when it is ready."}`}
          {status === "PENDING_REVIEW" &&
            (isAdmin
              ? "This listing is waiting for review. As an administrator you can publish it now."
              : "Your listing is waiting for review by the HAVORA team. You can keep editing in the meantime.")}
          {status === "PUBLISHED" && "Your listing is live and can be booked by guests."}
          {status === "UNLISTED" && "This listing is paused and hidden from search. Existing bookings are not affected."}
          {status === "REJECTED" && "This listing was not approved. Update it using the feedback below and resubmit."}
        </p>
        {status === "REJECTED" && property.rejectionReason && (
          <div className="mt-3">
            <Notice tone="warning">
              <strong>Reviewer feedback:</strong> {property.rejectionReason}
            </Notice>
          </div>
        )}
        <ActionForm action={listingStatusAction} className="mt-4" messagePosition="bottom">
          <input type="hidden" name="propertyId" value={property.id} />
          <div className="flex flex-wrap gap-2">
            {(status === "DRAFT" || status === "REJECTED" || (isAdmin && status === "PENDING_REVIEW")) && (
              <SubmitButton name="intent" value="submit">
                {reviewRequired ? (status === "REJECTED" ? "Resubmit for review" : "Submit for review") : "Publish listing"}
              </SubmitButton>
            )}
            {status === "PUBLISHED" && (
              <SubmitButton name="intent" value="unlist" className="btn btn-outline">
                Pause listing
              </SubmitButton>
            )}
            {status === "UNLISTED" && property.publishedAt && (
              <SubmitButton name="intent" value="relist">
                Relist
              </SubmitButton>
            )}
          </div>
        </ActionForm>
      </section>

      {/* ───── Photos ───── */}
      <section id="photos" className="card card-pad mb-8 scroll-mt-24">
        <h2 className="font-serif text-lg font-medium text-ink">Photos</h2>
        <p className="mt-1 mb-5 text-sm text-muted">The first photo is your cover image. Use the arrows to reorder.</p>
        <PhotoManager propertyId={property.id} images={property.images.map(({ id: imageId, url, alt }) => ({ id: imageId, url, alt }))} uploadsEnabled={cloudinaryConfigured()} />
      </section>

      {/* ───── Availability ───── */}
      <section id="availability" className="card card-pad mb-8 scroll-mt-24">
        <h2 className="font-serif text-lg font-medium text-ink">Availability calendar</h2>
        <p className="mt-1 mb-5 text-sm text-muted">Bookings block dates automatically. Add your own blocks for maintenance or personal use.</p>
        <div className="grid gap-6 md:grid-cols-3">
          {months.map((m) => (
            <MonthView key={`${m.year}-${m.month}`} {...m} kindOf={kindOf} today={today} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-emerald-50 ring-1 ring-emerald-200" /> Available</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-navy-800" /> Booked</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-cream-300" /> Blocked by you</span>
        </div>

        <div className="mt-6 grid gap-6 border-t border-cream-200 pt-6 lg:grid-cols-2">
          <ActionForm action={addBlockAction} resetOnSuccess>
            <input type="hidden" name="propertyId" value={property.id} />
            <h3 className="mb-3 text-sm font-semibold text-ink">Block dates</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField name="startDate" label="First blocked night" type="date" min={today} defaultValue={today} required />
              <TextField name="endDate" label="Reopens on" type="date" min={addDays(today, 1)} defaultValue={addDays(today, 1)} required hint="Guests can check in again from this date." />
              <TextField name="reason" label="Note (optional, private)" maxLength={120} className="sm:col-span-2" />
            </div>
            <SubmitButton className="btn btn-navy mt-3">Block dates</SubmitButton>
          </ActionForm>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink">Your blocked dates</h3>
            {upcomingBlocks.length === 0 ? (
              <p className="text-sm text-muted">No upcoming blocks.</p>
            ) : (
              <ul className="divide-y divide-cream-200 rounded-xl border border-cream-200">
                {upcomingBlocks.map((block) => (
                  <li key={block.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span>
                      <span className="font-medium text-ink">{formatDateRange(block.startDate, block.endDate)}</span>
                      {block.reason && <span className="block text-xs text-muted">{block.reason}</span>}
                    </span>
                    <ActionForm action={deleteBlockAction} compact>
                      <input type="hidden" name="propertyId" value={property.id} />
                      <input type="hidden" name="blockId" value={block.id} />
                      <SubmitButton className="btn btn-outline btn-sm">Reopen</SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ───── Details ───── */}
      <h2 className="mb-4 font-serif text-xl font-medium text-ink">Listing details</h2>
      <PropertyForm property={property} amenities={amenities} commissionRateBps={settings.commissionRateBps} categories={categories} isAdmin={user.role === "ADMIN"} uploadsEnabled={cloudinaryConfigured()} />

      {/* ───── Danger zone ───── */}
      <section className="mt-8 rounded-2xl border border-red-200 bg-white p-5 sm:p-6">
        <h2 className="font-serif text-lg font-medium text-ink">Delete listing</h2>
        {property._count.bookings > 0 ? (
          <p className="mt-1 text-sm text-muted">This listing has booking history, so it cannot be deleted. Pause it instead to hide it from guests.</p>
        ) : (
          <ActionForm action={deletePropertyAction} confirm={`Permanently delete “${property.title}”? This cannot be undone.`} messagePosition="bottom">
            <input type="hidden" name="propertyId" value={property.id} />
            <p className="mt-1 mb-4 text-sm text-muted">Permanently removes this listing and its photos. This cannot be undone.</p>
            <SubmitButton className="btn btn-danger">Delete listing</SubmitButton>
          </ActionForm>
        )}
      </section>
    </>
  );
}
