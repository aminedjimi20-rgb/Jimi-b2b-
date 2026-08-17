"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Button } from "@/components/ui/Button";
import { Menu, X, ChevronDown, Factory } from "lucide-react";
import clsx from "clsx";

export function Navbar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  const links = [
    { href: "/", label: t("home") },
    { href: "/machines", label: t("machines") },
    { href: "/acheter-machine", label: t("buy") },
    { href: "/vendre-machine", label: t("sell") },
    { href: "/realisations", label: t("realisations") },
    { href: "/blog", label: t("blog") },
    { href: "/contact", label: t("contact") },
  ];

  // Libellés raccourcis pour la barre desktop (espace restreint) — les pages
  // et le menu mobile conservent les libellés complets.
  const desktopLinks = [
    { href: "/", label: t("home") },
    { href: "/machines", label: t("machines") },
    { href: "/acheter-machine", label: t("buyShort") },
    { href: "/vendre-machine", label: t("sellShort") },
    { href: "/realisations", label: t("realisations") },
    { href: "/blog", label: t("blogShort") },
    { href: "/contact", label: t("contact") },
  ];

  return (
    <header
      className={clsx(
        "sticky top-0 z-50 border-b transition-colors",
        scrolled
          ? "border-[var(--color-border)] bg-white/95 backdrop-blur"
          : "border-transparent bg-white"
      )}
    >
      <div className="container-jimi flex h-16 items-center justify-between gap-4 md:h-20">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-ink)] text-white">
            <Factory size={20} />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold tracking-tight text-[var(--color-ink)]">
              JIMI
            </span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)] sm:block">
              Renovation & Installation
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 xl:flex">
          {desktopLinks.slice(0, 2).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap text-[var(--color-text)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-accent)]"
            >
              {link.label}
            </Link>
          ))}

          <div
            className="relative"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <Link
              href="/services"
              className="flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap text-[var(--color-text)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-accent)]"
            >
              {t("services")}
              <ChevronDown size={14} />
            </Link>
            {servicesOpen && (
              <div className="absolute start-0 top-full w-72 pt-2">
                <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-lg">
                  <Link
                    href="/services/renovation-machine-injection"
                    className="block px-4 py-3 text-sm hover:bg-[var(--color-surface-2)]"
                  >
                    {t("servicesMenu.renovation")}
                  </Link>
                  <Link
                    href="/services/automatisation-industrielle"
                    className="block px-4 py-3 text-sm hover:bg-[var(--color-surface-2)]"
                  >
                    {t("servicesMenu.automation")}
                  </Link>
                  <Link
                    href="/services/maintenance-depannage"
                    className="block px-4 py-3 text-sm hover:bg-[var(--color-surface-2)]"
                  >
                    {t("servicesMenu.maintenance")}
                  </Link>
                </div>
              </div>
            )}
          </div>

          {desktopLinks.slice(2).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap text-[var(--color-text)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-accent)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          <div className="hidden xl:block">
            <Button href="/contact" size="sm">
              {t("getQuote")}
            </Button>
          </div>
          <button
            type="button"
            aria-label="Menu"
            className="rounded-md p-2 text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] xl:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--color-border)] bg-white xl:hidden">
          <nav className="container-jimi flex flex-col gap-1 py-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-3 text-base font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-1 border-t border-[var(--color-border)] pt-3">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {t("services")}
              </p>
              <Link
                href="/services/renovation-machine-injection"
                className="block rounded-md px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              >
                {t("servicesMenu.renovation")}
              </Link>
              <Link
                href="/services/automatisation-industrielle"
                className="block rounded-md px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              >
                {t("servicesMenu.automation")}
              </Link>
              <Link
                href="/services/maintenance-depannage"
                className="block rounded-md px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              >
                {t("servicesMenu.maintenance")}
              </Link>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
              <LanguageSwitcher />
              <Button href="/contact" size="sm" className="flex-1">
                {t("getQuote")}
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
