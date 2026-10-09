import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { ROLE_LABEL } from "@/lib/constants";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  const links = [
    { href: "/account", label: "Dashboard", icon: "dashboard" },
    { href: "/account/bookings", label: "My Bookings", icon: "bookings" },
    { href: "/account/wishlist", label: "Wishlist", icon: "wishlist" },
    { href: "/account/reviews", label: "Reviews", icon: "reviews" },
    { href: "/account/settings", label: "Profile Settings", icon: "settings" },
    ...(user.role === "OWNER" ? [{ href: "/owner", label: "Host dashboard", icon: "properties" }] : []),
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Admin dashboard", icon: "platform" }] : []),
  ];
  return (
    <DashboardShell user={user} roleLabel={ROLE_LABEL[user.role]} links={links}>
      {children}
    </DashboardShell>
  );
}
