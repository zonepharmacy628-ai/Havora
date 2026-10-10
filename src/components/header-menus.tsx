"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Avatar } from "./ui";

export type NavLink = { href: string; label: string };

export function MainNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-6 lg:flex xl:gap-8" aria-label="Main">
      {links.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`relative py-2 text-[13px] font-medium tracking-wide whitespace-nowrap transition ${active ? "text-white" : "text-navy-200 hover:text-white"}`}
          >
            {link.label}
            {active && <span className="absolute inset-x-0 -bottom-0.5 h-px bg-gold-500" />}
          </Link>
        );
      })}
    </nav>
  );
}

type MenuUser = {
  name: string;
  email: string;
  roleLabel: string;
  /** Only hosts and administrators have dashboards. */
  dashboards: NavLink[];
  links: NavLink[];
};

export function UserMenu({ user }: { user: MenuUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex cursor-pointer items-center gap-2 rounded-full border border-white/15 py-1 pr-2.5 pl-1 text-white transition hover:border-gold-500/70"
      >
        <Avatar name={user.name} className="size-8 text-xs" />
        <span className="hidden max-w-28 truncate text-[13px] font-medium sm:block">{user.name.split(" ")[0]}</span>
        <ChevronDown className={`size-4 text-navy-200 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="animate-fade-up absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-cream-200 bg-white shadow-lift">
          <div className="border-b border-cream-200 bg-cream-50 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <p className="mt-1.5 text-[10px] font-semibold tracking-widest text-gold-600 uppercase">{user.roleLabel}</p>
          </div>
          <div className="p-1.5" onClick={() => setOpen(false)}>
            {user.dashboards.map((link) => (
              <Link key={link.href} href={link.href} role="menuitem" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-cream-100">
                <LayoutDashboard className="size-4 text-gold-600" aria-hidden="true" /> {link.label}
              </Link>
            ))}
            {user.links.map((link) => (
              <Link key={link.href} href={link.href} role="menuitem" className={`block rounded-lg px-3 py-2 text-sm text-ink hover:bg-cream-100 ${user.dashboards.length ? "pl-[38px]" : ""}`}>
                {link.label}
              </Link>
            ))}
          </div>
          <form action={logoutAction} className="border-t border-cream-200 p-1.5">
            <button type="submit" role="menuitem" className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

type MobileNavProps = {
  links: NavLink[];
  signedIn: boolean;
  /** Show the "List Your Property" call to action (hidden for people who already host). */
  showHostCta: boolean;
};

export function MobileNav({ links, signedIn, showHostCta }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex size-10 cursor-pointer items-center justify-center rounded-lg border border-white/15 text-white"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && (
        <div id="mobile-menu" className="animate-fade-up absolute inset-x-0 top-full z-40 max-h-[calc(100vh-68px)] overflow-y-auto border-t border-white/10 bg-navy-900 px-4 pt-2 pb-5 shadow-lift">
          {showHostCta && (
            <Link href="/host" onClick={() => setOpen(false)} className="btn btn-gold mt-3 mb-1 w-full py-3 text-[15px]">
              List Your Property
            </Link>
          )}
          <nav className="flex flex-col" aria-label="Mobile" onClick={() => setOpen(false)}>
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="border-b border-white/5 py-3.5 text-[15px] font-medium text-white">
                {link.label}
              </Link>
            ))}
          </nav>
          {!signedIn && (
            <Link href="/login" onClick={() => setOpen(false)} className="btn btn-ghost-light mt-4 w-full">
              Host sign in
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
