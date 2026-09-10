"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Button } from "@/components/ui/Button";
import { Menu, X, ChevronDown, Factory } from "lucide-react";
import clsx from "clsx";

type DropdownKey = "machines" | "pieces" | "services";

export function Navbar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  const [mobileOpenSection, setMobileOpenSection] = useState<DropdownKey | null>(null);
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
    setMobileOpenSection(null);
  }

  const machinesMenu = [
    { href: "/machines", label: t("machinesMenu.available") },
    { href: "/vendre-machine", label: t("machinesMenu.sell") },
    { href: "/acheter-machine", label: t("machinesMenu.buy") },
  ];

  const piecesMenu = [
    { href: "/pieces-industrielles/electrique", label: t("piecesMenu.electrique") },
    { href: "/pieces-industrielles/electronique", label: t("piecesMenu.electronique") },
    { href: "/pieces-industrielles/hydraulique", label: t("piecesMenu.hydraulique") },
    { href: "/pieces-industrielles/mecanique", label: t("piecesMenu.mecanique") },
    { href: "/pieces-industrielles/automatisme", label: t("piecesMenu.automatisme") },
    { href: "/pieces-industrielles/plc-hmi", label: t("piecesMenu.plc-hmi") },
    { href: "/pieces-industrielles/variateurs", label: t("piecesMenu.variateurs") },
    { href: "/pieces-industrielles/servo-moteurs", label: t("piecesMenu.servo-moteurs") },
    { href: "/vendre-equipement?type=piece", label: t("piecesMenu.sell") },
  ];

  const servicesMenu = [
    { href: "/services/renovation-machine-injection", label: t("servicesMenu.renovation") },
    { href: "/services/automatisation-industrielle", label: t("servicesMenu.automation") },
    { href: "/services/maintenance-depannage", label: t("servicesMenu.maintenance") },
  ];

  const moulesLink = { href: "/pieces-industrielles/moules", label: t("moulesShort") };

  const buySellLinks = [
    { href: "/acheter-machine", label: t("acheter") },
    { href: "/vendre-equipement", label: t("vendre") },
  ];

  const trailingLinks = [
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
              JIMI <span className="text-[var(--color-accent)]">INDUSTRIE</span>
            </span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)] sm:block">
              Machines · Pièces · Moules · Automatisation
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 xl:flex">
          <Link
            href="/"
            className="rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap text-[var(--color-text)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-accent)]"
          >
            {t("home")}
          </Link>

          <DesktopDropdown
            triggerHref="/machines"
            triggerLabel={t("machinesShort")}
            items={machinesMenu}
            openKey="machines"
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />

          <DesktopDropdown
            triggerHref="/pieces-industrielles"
            triggerLabel={t("piecesShort")}
            items={piecesMenu}
            openKey="pieces"
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />

          <Link
            href={moulesLink.href}
            className="rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap text-[var(--color-text)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-accent)]"
          >
            {moulesLink.label}
          </Link>

          <DesktopDropdown
            triggerHref="/services"
            triggerLabel={t("services")}
            items={servicesMenu}
            openKey="services"
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />

          {[...buySellLinks, ...trailingLinks].map((link) => (
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
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-[var(--color-border)] bg-white xl:hidden">
          <nav className="container-jimi flex flex-col gap-1 py-4">
            <Link
              href="/"
              className="rounded-md px-3 py-3 text-base font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            >
              {t("home")}
            </Link>

            <MobileAccordionSection
              sectionKey="machines"
              label={t("machinesShort")}
              items={machinesMenu}
              openSection={mobileOpenSection}
              setOpenSection={setMobileOpenSection}
            />

            <MobileAccordionSection
              sectionKey="pieces"
              label={t("piecesShort")}
              items={piecesMenu}
              openSection={mobileOpenSection}
              setOpenSection={setMobileOpenSection}
            />

            <Link
              href={moulesLink.href}
              className="rounded-md px-3 py-3 text-base font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            >
              {moulesLink.label}
            </Link>

            <MobileAccordionSection
              sectionKey="services"
              label={t("services")}
              items={servicesMenu}
              openSection={mobileOpenSection}
              setOpenSection={setMobileOpenSection}
            />

            {[...buySellLinks, ...trailingLinks].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-3 text-base font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
              <LanguageSwitcher align="start" dropUp />
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

function DesktopDropdown({
  triggerHref,
  triggerLabel,
  items,
  openKey,
  openDropdown,
  setOpenDropdown,
}: {
  triggerHref: string;
  triggerLabel: string;
  items: { href: string; label: string }[];
  openKey: DropdownKey;
  openDropdown: DropdownKey | null;
  setOpenDropdown: (key: DropdownKey | null) => void;
}) {
  const isOpen = openDropdown === openKey;
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpenDropdown(openKey)}
      onMouseLeave={() => setOpenDropdown(null)}
    >
      <Link
        href={triggerHref}
        className="flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap text-[var(--color-text)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-accent)]"
      >
        {triggerLabel}
        <ChevronDown size={14} />
      </Link>
      {isOpen && (
        <div className="absolute start-0 top-full w-72 pt-2">
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-lg">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-4 py-3 text-sm hover:bg-[var(--color-surface-2)]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileAccordionSection({
  sectionKey,
  label,
  items,
  openSection,
  setOpenSection,
}: {
  sectionKey: DropdownKey;
  label: string;
  items: { href: string; label: string }[];
  openSection: DropdownKey | null;
  setOpenSection: (key: DropdownKey | null) => void;
}) {
  const isOpen = openSection === sectionKey;
  return (
    <div className="border-b border-[var(--color-border)] last:border-0">
      <button
        type="button"
        onClick={() => setOpenSection(isOpen ? null : sectionKey)}
        className="flex w-full items-center justify-between rounded-md px-3 py-3 text-base font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
        aria-expanded={isOpen}
      >
        {label}
        <ChevronDown size={16} className={clsx("transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="flex flex-col gap-0.5 pb-2 ps-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
