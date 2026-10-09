import Link from "next/link";
import { Heart } from "lucide-react";
import { PropertyCard } from "@/components/property-card";
import { EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { cardSelect } from "@/lib/properties";
import { requireUser } from "@/lib/session";

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const saved = await prisma.wishlist.findMany({
    where: { userId: user.id, property: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    select: { property: { select: cardSelect } },
  });

  return (
    <>
      <PageHeader title="Wishlist" subtitle="Properties you've saved for later." />
      {saved.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {saved.map(({ property }) => (
            <PropertyCard key={property.id} property={property} saved showButton />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          text="Tap the heart on any property to save it here."
          action={
            <Link href="/properties" className="btn btn-gold">
              Explore properties
            </Link>
          }
        />
      )}
    </>
  );
}
