import Link from "next/link";
import { ROLE_LABEL } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { Logo } from "./logo";
import { MainNav, MobileNav, UserMenu, type NavLink } from "./header-menus";
import { WishlistLink } from "./wishlist-button";

const LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/properties", label: "Properties" },
  { href: "/host", label: "List Your Property" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const MOBILE_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/properties", label: "Properties" },
  { href: "/bookings", label: "My Bookings" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

// HAVORA has two dashboards only: the Owner Dashboard and the Admin Dashboard.
// Guests and legacy customer accounts use ordinary site pages.
// The Admin Dashboard is deliberately not linked from the public site: the
// administrator opens it by typing its address (/admin) and signing in.
const DASHBOARDS: Record<string, NavLink[]> = {
  CUSTOMER: [],
  OWNER: [{ href: "/owner", label: "Owner Dashboard" }],
  ADMIN: [{ href: "/owner", label: "Owner Dashboard" }],
};

const MENU_LINKS: Record<string, NavLink[]> = {
  CUSTOMER: [
    { href: "/bookings", label: "My bookings" },
    { href: "/wishlist", label: "Wishlist" },
  ],
  OWNER: [
    { href: "/owner/properties/new", label: "Add a property" },
    { href: "/owner/bookings", label: "Reservations" },
    { href: "/bookings", label: "My bookings" },
  ],
  ADMIN: [
    { href: "/owner/properties/new", label: "Add a property" },
    { href: "/bookings", label: "My bookings" },
  ],
};

export async function SiteHeader() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const isHost = user?.role === "OWNER" || user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-900/95 backdrop-blur-md">
      {settings.announcement && (
        <div className="bg-gold-500 px-4 py-1.5 text-center text-xs font-semibold text-navy-950">{settings.announcement}</div>
      )}
      <div className="container-page relative flex h-[68px] items-center justify-between gap-3">
        <Logo />
        <MainNav links={LINKS} />
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <Link href="/bookings" className="hidden rounded-lg px-2.5 py-2 text-[13px] font-medium whitespace-nowrap text-navy-200 transition hover:text-white xl:block">
            My Bookings
          </Link>
          <WishlistLink />
          {user ? (
            <UserMenu
              user={{
                name: user.name,
                email: user.email,
                roleLabel: ROLE_LABEL[user.role],
                dashboards: DASHBOARDS[user.role],
                links: MENU_LINKS[user.role],
              }}
            />
          ) : (
            <Link href="/login" className="hidden rounded-lg px-2.5 py-2 text-[13px] font-medium whitespace-nowrap text-navy-200 transition hover:text-white sm:block">
              Sign in
            </Link>
          )}
          {!isHost && (
            <Link href="/host" className="btn btn-gold btn-sm hidden px-4 py-2 text-[13px] sm:inline-flex">
              List Your Property
            </Link>
          )}
          <MobileNav links={MOBILE_LINKS} signedIn={Boolean(user)} showHostCta={!isHost} />
        </div>
      </div>
    </header>
  );
}
