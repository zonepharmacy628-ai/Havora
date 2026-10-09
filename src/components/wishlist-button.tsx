"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleWishlistAction } from "@/actions/misc";

type Props = { propertyId: string; initialSaved: boolean; variant?: "icon" | "button" };

export function WishlistButton({ propertyId, initialSaved, variant = "icon" }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      setOptimisticSaved(!saved);
      const result = await toggleWishlistAction(propertyId);
      if (result.needsLogin) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      if (result.ok) setSaved(result.saved);
    });
  }

  const label = optimisticSaved ? "Remove from wishlist" : "Add to wishlist";

  if (variant === "button") {
    return (
      <button type="button" onClick={toggle} disabled={pending} aria-pressed={optimisticSaved} className="btn btn-outline w-full">
        <Heart className={`size-4 ${optimisticSaved ? "fill-gold-500 text-gold-500" : ""}`} aria-hidden="true" />
        {optimisticSaved ? "Saved to wishlist" : "Add to wishlist"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={optimisticSaved}
      aria-label={label}
      title={label}
      className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-navy-950/45 text-white backdrop-blur-sm transition hover:bg-navy-950/70"
    >
      <Heart className={`size-[18px] transition ${optimisticSaved ? "fill-gold-400 text-gold-400" : ""}`} aria-hidden="true" />
    </button>
  );
}
