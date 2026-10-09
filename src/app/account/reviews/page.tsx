import Link from "next/link";
import { Star } from "lucide-react";
import { EmptyState, PageHeader, Stars } from "@/components/ui";
import { completeFinishedStays } from "@/lib/bookings";
import { formatDate, formatDateRange } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export default async function MyReviewsPage() {
  const user = await requireUser("/account/reviews");
  await completeFinishedStays(prisma, { customerId: user.id });

  const [awaiting, reviews] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId: user.id, status: "COMPLETED", review: null },
      orderBy: { checkOut: "desc" },
      select: { id: true, reference: true, checkIn: true, checkOut: true, property: { select: { title: true } } },
    }),
    prisma.review.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      include: { property: { select: { title: true, slug: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader title="Reviews" subtitle="Share feedback on stays you've completed. Only guests who stayed can review a property." />

      {awaiting.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-ink">Waiting for your review</h2>
          <ul className="card divide-y divide-cream-200">
            {awaiting.map((booking) => (
              <li key={booking.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-serif text-[17px] font-medium text-ink">{booking.property.title}</p>
                  <p className="text-xs text-muted">Stayed {formatDateRange(booking.checkIn, booking.checkOut)}</p>
                </div>
                <Link href={`/booking/${booking.reference}`} className="btn btn-gold btn-sm">
                  Write a review
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviews.length > 0 ? (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/properties/${review.property.slug}`} className="font-serif text-[17px] font-medium text-ink hover:text-gold-700">
                    {review.property.title}
                  </Link>
                  <p className="text-xs text-muted">Reviewed {formatDate(review.createdAt)}</p>
                </div>
                <Stars rating={review.rating} />
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{review.comment}</p>
              {review.status === "HIDDEN" && <p className="mt-2 text-xs font-medium text-red-600">Hidden by a moderator — not visible on the property page.</p>}
            </li>
          ))}
        </ul>
      ) : (
        awaiting.length === 0 && <EmptyState icon={Star} title="No reviews yet" text="After you complete a stay you'll be able to rate and review it here." />
      )}
    </>
  );
}
