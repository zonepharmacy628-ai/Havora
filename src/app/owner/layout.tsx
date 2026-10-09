import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Host dashboard", robots: { index: false } };

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  // Administrators may open an owner's listing editor; every page re-checks access itself.
  const user = await requireRole(["OWNER", "ADMIN"], "/owner");
  const pending =
    user.role === "OWNER"
      ? await prisma.booking.count({ where: { property: { ownerId: user.id }, status: { in: ["PENDING", "CANCELLATION_REQUESTED"] } } })
      : 0;

  const links =
    user.role === "ADMIN"
      ? [{ href: "/admin", label: "Back to admin", icon: "platform" }]
      : [
          { href: "/owner", label: "Dashboard", icon: "dashboard" },
          { href: "/owner/properties", label: "My Properties", icon: "properties" },
          { href: "/owner/bookings", label: "Reservations", icon: "bookings", badge: pending },
          { href: "/owner/earnings", label: "Earnings", icon: "earnings" },
          { href: "/owner/settings", label: "Profile Settings", icon: "settings" },
          { href: "/account/bookings", label: "My trips", icon: "wishlist" },
        ];

  return (
    <DashboardShell user={user} roleLabel={user.role === "ADMIN" ? "Administrator" : "Property Owner"} links={links}>
      {children}
    </DashboardShell>
  );
}
