import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { PropertyCardData } from "@/lib/properties";
import { Rating } from "./ui";
import { WishlistButton } from "./wishlist-button";

type Props = {
  property: PropertyCardData;
  /** Query string (e.g. dates and guests) carried through to the details page. */
  query?: string;
  showButton?: boolean;
  priority?: boolean;
};

export function PropertyCard({ property, query = "", showButton = false, priority = false }: Props) {
  const href = `/properties/${property.slug}${query}`;
  const cover = property.images[0];

  return (
    <article className="group card relative flex flex-col overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden bg-cream-200">
        {cover && (
          <Image
            src={cover.url}
            alt={cover.alt || property.title}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition duration-700 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
          {property.featured ? (
            <span className="badge bg-gold-500 text-navy-950 shadow-sm">Featured</span>
          ) : (
            <span className="badge bg-navy-950/55 text-white backdrop-blur-sm">{property.category?.name ?? "Stay"}</span>
          )}
          <WishlistButton propertyId={property.id} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-serif text-[17px] leading-snug font-medium text-ink">
          <Link href={href} className="after:absolute after:inset-0 after:z-0 hover:text-gold-700">
            {property.title}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1 text-[13px] text-muted">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {property.city}, {property.country}
          </span>
        </p>
        <Rating value={property.ratingAvg} count={property.ratingCount} className="mt-2" />
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="text-[13px] text-muted">
            <span className="font-serif text-xl font-semibold text-ink">{formatMoney(property.nightlyPriceCents, property.currency)}</span> / night
          </p>
          {showButton && (
            <span className="btn btn-navy btn-sm" aria-hidden="true">
              View Details <ArrowRight className="size-3.5" />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
