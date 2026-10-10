import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { HOST_ROLES } from "@/lib/booking-rules";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Owner Dashboard", robots: { index: false } };

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  // Owners and administrators can host. Every page and action re-checks role and ownership itself.
  const user = await requireRole(HOST_ROLES, "/owner");
  const pending = await prisma.booking.count({
    where: { property: { ownerId: user.id }, status: { in: ["PENDING", "CANCELLATION_REQUESTED"] } },
  });

  const links = [
    { href: "/owner", label: "Dashboard", icon: "dashboard" },
    { href: "/owner/properties", label: "My Properties", icon: "properties" },
    { href: "/owner/bookings", label: "Reservations", icon: "bookings", badge: pending },
    { href: "/owner/earnings", label: "Earnings", icon: "earnings" },
    { href: "/owner/settings", label: "Profile Settings", icon: "settings" },
  ];

  return (
    <DashboardShell user={user} roleLabel={user.role === "ADMIN" ? "Administrator" : "Property Owner"} links={links}>
      {children}
    </DashboardShell>
  );
}
