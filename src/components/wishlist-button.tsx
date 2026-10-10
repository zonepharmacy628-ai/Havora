"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart } from "lucide-react";
import { toggleWishlist, useWishlist } from "@/lib/wishlist-store";

type Props = { propertyId: string; variant?: "icon" | "button" };

/** Saves a property to the browser wishlist — no account needed. */
export function WishlistButton({ propertyId, variant = "icon" }: Props) {
  const saved = useWishlist().includes(propertyId);
  const [failed, setFailed] = useState(false);

  function toggle() {
    setFailed(!toggleWishlist(propertyId));
  }

  const label = saved ? "Remove from wishlist" : "Add to wishlist";

  if (variant === "button") {
    return (
      <div>
        <button type="button" onClick={toggle} aria-pressed={saved} className="btn btn-outline w-full">
          <Heart className={`size-4 ${saved ? "fill-gold-500 text-gold-500" : ""}`} aria-hidden="true" />
          {saved ? "Saved to wishlist" : "Add to wishlist"}
        </button>
        {failed && (
          <p role="alert" className="mt-1.5 text-xs text-red-600">
            Your browser blocked saving this. Check that site storage is allowed.
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={label}
      title={failed ? "Your browser blocked saving this" : label}
      className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-navy-950/45 text-white backdrop-blur-sm transition hover:bg-navy-950/70"
    >
      <Heart className={`size-[18px] transition ${saved ? "fill-gold-400 text-gold-400" : ""}`} aria-hidden="true" />
    </button>
  );
}

/** Header link to the wishlist page with a live count. */
export function WishlistLink({ className = "" }: { className?: string }) {
  const count = useWishlist().length;
  return (
    <Link
      href="/wishlist"
      aria-label={count > 0 ? `Wishlist, ${count} saved` : "Wishlist"}
      title="Wishlist"
      className={`relative flex size-10 items-center justify-center rounded-full text-navy-200 transition hover:text-gold-300 ${className}`}
    >
      <Heart className="size-5" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute top-0.5 right-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] leading-[18px] font-bold text-navy-950">
          {count}
        </span>
      )}
    </Link>
  );
}
