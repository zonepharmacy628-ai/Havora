import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { moderateReviewAction } from "@/actions/admin";
import { StatusTabs } from "@/components/booking-list";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, PageHeader, Stars } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole(["ADMIN"], "/admin/reviews");
  const { status = "" } = await searchParams;
  const filter = status === "HIDDEN" ? "HIDDEN" : status === "PUBLISHED" ? "PUBLISHED" : null;

  const [reviews, published, hidden] = await Promise.all([
    prisma.review.findMany({
      where: filter ? { status: filter } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { author: { select: { name: true, email: true } }, property: { select: { title: true, slug: true } }, booking: { select: { reference: true } } },
    }),
    prisma.review.count({ where: { status: "PUBLISHED" } }),
    prisma.review.count({ where: { status: "HIDDEN" } }),
  ]);

  return (
    <>
      <PageHeader title="Reviews" subtitle="Hide reviews that break the content rules. Hidden reviews are excluded from property ratings." />
      <StatusTabs
        base="/admin/reviews"
        current={filter ?? ""}
        tabs={[
          { value: "", label: "All", count: published + hidden },
          { value: "PUBLISHED", label: "Published", count: published },
          { value: "HIDDEN", label: "Hidden", count: hidden },
        ]}
      />
      {reviews.length === 0 ? (
        <EmptyState icon={MessageSquareText} title="No reviews" text="Guest reviews will appear here once stays are completed." />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className={`card card-pad ${review.status === "HIDDEN" ? "opacity-75" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={review.rating} className="size-3.5" />
                    <Link href={`/properties/${review.property.slug}`} className="text-sm font-semibold text-ink hover:text-gold-700">
                      {review.property.title}
                    </Link>
                    {review.status === "HIDDEN" && <span className="badge bg-red-50 text-red-700 ring-1 ring-red-200">Hidden</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {review.author ? `${review.author.name} (${review.author.email})` : `${review.authorName ?? "Guest"} (guest booking)`} · {formatDate(review.createdAt)} · booking{" "}
                    <Link href={`/booking/${review.booking.reference}`} className="font-medium text-gold-700 hover:underline">
                      {review.booking.reference}
                    </Link>
                  </p>
                </div>
                <ActionForm action={moderateReviewAction} compact messagePosition="bottom">
                  <input type="hidden" name="reviewId" value={review.id} />
                  <input type="hidden" name="status" value={review.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED"} />
                  <SubmitButton className={review.status === "PUBLISHED" ? "btn btn-danger btn-sm" : "btn btn-outline btn-sm"}>
                    {review.status === "PUBLISHED" ? "Hide review" : "Restore"}
                  </SubmitButton>
                </ActionForm>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{review.comment}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
