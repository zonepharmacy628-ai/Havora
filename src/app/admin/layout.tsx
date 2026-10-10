import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Non-administrators are redirected to their own dashboard; each page and action re-checks the role.
  const user = await requireRole(["ADMIN"], "/admin");
  const [pendingListings, newMessages] = await Promise.all([
    prisma.property.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
  ]);

  const links = [
    { href: "/admin", label: "Dashboard", icon: "dashboard" },
    { href: "/admin/users", label: "Users", icon: "users" },
    { href: "/admin/properties", label: "Properties", icon: "properties", badge: pendingListings },
    { href: "/admin/bookings", label: "Bookings", icon: "bookings" },
    { href: "/admin/reviews", label: "Reviews", icon: "moderation" },
    { href: "/admin/reports", label: "Reports", icon: "reports" },
    { href: "/admin/messages", label: "Messages", icon: "messages", badge: newMessages },
    { href: "/admin/settings", label: "Settings", icon: "platform" },
    { href: "/admin/audit", label: "Audit Logs", icon: "audit" },
    { href: "/owner", label: "My Properties", icon: "earnings" },
  ];

  return (
    <DashboardShell user={user} roleLabel="Administrator" links={links}>
      {children}
    </DashboardShell>
  );
}
