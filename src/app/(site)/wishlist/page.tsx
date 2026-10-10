import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { WishlistView } from "@/components/wishlist-view";
import { getLegacyWishlistIds } from "@/lib/properties";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Wishlist", description: "Properties you have saved on this device.", robots: { index: false } };

export default async function WishlistPage() {
  const user = await getCurrentUser();
  const legacyIds = await getLegacyWishlistIds(user?.id);

  return (
    <>
      <PageHero eyebrow="Wishlist" title="Your saved stays" subtitle="Keep track of the places you love and come back when you're ready to book." />
      <div className="container-page py-12">
        <WishlistView legacyIds={legacyIds} />
      </div>
    </>
  );
}
