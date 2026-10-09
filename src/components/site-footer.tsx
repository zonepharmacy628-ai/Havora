import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Logo } from "./logo";
import { NewsletterForm } from "./newsletter-form";

const COLUMNS = [
  {
    title: "Quick Links",
    links: [
      { href: "/", label: "Home" },
      { href: "/properties", label: "Properties" },
      { href: "/about", label: "About Us" },
      { href: "/contact", label: "Contact" },
      { href: "/register?type=owner", label: "Become a Host" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/help", label: "Help Center & FAQ" },
      { href: "/cancellation-policy", label: "Cancellation Policy" },
      { href: "/terms", label: "Terms & Conditions" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
];

export async function SiteFooter() {
  const { supportEmail } = await getSettings();
  return (
    <footer className="navy-texture border-t border-white/10 text-navy-200">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.4fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-xs text-sm leading-6">
            Handpicked villas, apartments and hotels in the world&apos;s most beautiful destinations — reserved online, paid at the property.
          </p>
          <a href={`mailto:${supportEmail}`} className="mt-4 inline-block text-sm font-medium text-gold-400 hover:text-gold-300">
            {supportEmail}
          </a>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h3 className="mb-4 text-sm font-semibold text-white">{column.title}</h3>
            <ul className="space-y-2.5 text-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-gold-300">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-white">Subscribe to our Newsletter</h3>
          <p className="mb-4 text-sm">Get exclusive stays and travel inspiration.</p>
          <NewsletterForm />
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs sm:flex-row">
          <p>© {new Date().getFullYear()} HAVORA. All rights reserved.</p>
          <p>Prices shown in USD · Stay dates use each property&apos;s local time</p>
        </div>
      </div>
    </footer>
  );
}
