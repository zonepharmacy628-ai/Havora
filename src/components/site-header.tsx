import Link from "next/link";
import { CircleDollarSign } from "lucide-react";
import { ROLE_LABEL } from "@/lib/constants";
import { dashboardPathFor, getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { Logo } from "./logo";
import { MainNav, MobileNav, UserMenu, type NavLink } from "./header-menus";

const LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/properties", label: "Properties" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const MENU_LINKS: Record<string, NavLink[]> = {
  CUSTOMER: [
    { href: "/account/bookings", label: "My bookings" },
    { href: "/account/wishlist", label: "Wishlist" },
    { href: "/account/settings", label: "Profile settings" },
  ],
  OWNER: [
    { href: "/owner/properties", label: "My properties" },
    { href: "/owner/bookings", label: "Reservations" },
    { href: "/account/bookings", label: "My trips" },
  ],
  ADMIN: [
    { href: "/admin/properties", label: "Listings" },
    { href: "/admin/bookings", label: "Bookings" },
    { href: "/admin/users", label: "Users" },
  ],
};

export async function SiteHeader() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-900/95 backdrop-blur-md">
      {settings.announcement && (
        <div className="bg-gold-500 px-4 py-1.5 text-center text-xs font-semibold text-navy-950">{settings.announcement}</div>
      )}
      <div className="container-page relative flex h-[68px] items-center justify-between gap-4">
        <Logo />
        <MainNav links={LINKS} />
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs font-medium text-navy-200 lg:flex" title="Prices are shown in US dollars">
            <CircleDollarSign className="size-4" aria-hidden="true" /> USD
          </span>
          {user ? (
            <UserMenu
              user={{
                name: user.name,
                email: user.email,
                roleLabel: ROLE_LABEL[user.role],
                dashboardHref: dashboardPathFor(user.role),
                links: MENU_LINKS[user.role],
              }}
            />
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/login" className="rounded-lg px-3 py-2 text-[13px] font-medium text-navy-200 transition hover:text-white">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-gold btn-sm px-4 py-2 text-[13px]">
                Get Started
              </Link>
            </div>
          )}
          <MobileNav links={LINKS} signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}
