"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  Heart,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquareText,
  Settings,
  SlidersHorizontal,
  Star,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/actions/auth";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  bookings: CalendarCheck,
  wishlist: Heart,
  reviews: Star,
  settings: Settings,
  properties: Building2,
  earnings: Wallet,
  users: Users,
  reports: BarChart3,
  platform: SlidersHorizontal,
  messages: Mail,
  moderation: MessageSquareText,
  audit: ClipboardList,
};

export type DashboardLink = { href: string; label: string; icon: keyof typeof ICONS | string; badge?: number };

export function DashboardNav({ links }: { links: DashboardLink[] }) {
  const pathname = usePathname();
  // The most specific matching link wins, so "/owner" is not active on "/owner/bookings".
  const active = links
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-4 lg:pb-0">
      {links.map((link) => {
        const Icon = ICONS[link.icon] ?? LayoutDashboard;
        const isActive = link.href === active;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap transition ${
              isActive ? "bg-white/10 text-white shadow-[inset_2px_0_0_var(--color-gold-500)]" : "text-navy-200 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className={`size-[18px] ${isActive ? "text-gold-400" : ""}`} aria-hidden="true" />
            {link.label}
            {link.badge ? <span className="ml-auto rounded-full bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold text-navy-950">{link.badge}</span> : null}
          </Link>
        );
      })}
      <form action={logoutAction} className="shrink-0 lg:mt-2 lg:border-t lg:border-white/10 lg:pt-2">
        <button type="submit" className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap text-navy-200 transition hover:bg-white/5 hover:text-white">
          <LogOut className="size-[18px]" aria-hidden="true" /> Logout
        </button>
      </form>
    </nav>
  );
}
