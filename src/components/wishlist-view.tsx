"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, Info } from "lucide-react";
import { getWishlistPropertiesAction } from "@/actions/misc";
import type { PropertyCardData } from "@/lib/properties";
import { importLegacyWishlist, removeFromWishlist, useWishlist } from "@/lib/wishlist-store";
import { PropertyCard } from "./property-card";

/** Renders the browser wishlist. `legacyIds` are a signed-in legacy account's saved properties, imported once. */
export function WishlistView({ legacyIds }: { legacyIds: string[] }) {
  const ids = useWishlist();
  const [loaded, setLoaded] = useState<{ key: string; items: PropertyCardData[] } | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    importLegacyWishlist(legacyIds);
  }, [legacyIds]);

  useEffect(() => {
    let cancelled = false;
    const current = key ? key.split(",") : [];
    getWishlistPropertiesAction(current)
      .then((items) => {
        if (cancelled) return;
        setLoaded({ key, items });
        // Listings that were removed or unpublished drop off the saved list.
        const available = new Set(items.map((item) => item.id));
        const gone = current.filter((id) => !available.has(id));
        if (gone.length > 0) removeFromWishlist(gone);
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const ready = loaded !== null && loaded.key === key;
  const items = ready ? loaded.items : [];

  return (
    <>
      {!ready ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Loading your wishlist">
          {Array.from({ length: Math.min(Math.max(ids.length, 1), 4) }, (_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="skeleton aspect-[4/3] rounded-none" />
              <div className="space-y-3 p-4">
                <div className="skeleton h-5 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-gold-50 text-gold-600 ring-1 ring-gold-100">
            <Heart className="size-6" aria-hidden="true" />
          </span>
          <h2 className="heading-serif text-xl">Your wishlist is empty</h2>
          <p className="mt-1.5 max-w-md text-sm text-muted">Tap the heart on any property to save it here. No account needed.</p>
          <Link href="/properties" className="btn btn-gold mt-5">
            Explore properties
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((property) => (
            <PropertyCard key={property.id} property={property} showButton />
          ))}
        </div>
      )}

      <p className="mt-8 flex items-start gap-2 rounded-lg border border-cream-200 bg-white px-4 py-3 text-xs leading-5 text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-gold-600" aria-hidden="true" />
        Your wishlist is saved in this browser on this device only. It is not synced to other devices and is removed if you clear your browser data or use private browsing.
      </p>
    </>
  );
}
