import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { DashboardNav, type DashboardLink } from "./dashboard-nav";
import { SiteHeader } from "./site-header";
import { Avatar } from "./ui";

type Props = {
  user: { name: string };
  roleLabel: string;
  links: DashboardLink[];
  children: ReactNode;
};

export function DashboardShell({ user, roleLabel, links, children }: Props) {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="navy-texture shrink-0 border-b border-white/10 lg:w-64 lg:border-r lg:border-b-0">
          <div className="lg:sticky lg:top-[68px]">
            <div className="flex items-center gap-3 px-6 py-5">
              <Avatar name={user.name} className="size-11 text-sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <p className="text-[11px] font-medium tracking-wider text-gold-400 uppercase">{roleLabel}</p>
              </div>
            </div>
            {/* Opens the public site in a new tab, exactly as visitors see it. A relative
                address is used, so it always points at whichever domain the site is running on. */}
            <div className="px-4 pb-4">
              <a
                href="/"
                target="_blank"
                rel="noopener"
                className="btn w-full border border-gold-500/50 bg-gold-500/10 text-gold-300 hover:border-gold-400 hover:bg-gold-500/20 hover:text-gold-200"
              >
                <ExternalLink className="size-4" aria-hidden="true" /> View Website
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
            <DashboardNav links={links} />
          </div>
        </aside>
        <main id="main" className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </>
  );
}
