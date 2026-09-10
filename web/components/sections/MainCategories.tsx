import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Link } from "@/i18n/navigation";
import { Factory, Cog, Box, Zap, Droplet, Bot, Wrench, RefreshCw, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CATEGORIES: { key: string; href: string; icon: LucideIcon }[] = [
  { key: "machines", href: "/machines", icon: Factory },
  { key: "pieces", href: "/pieces-industrielles", icon: Cog },
  { key: "moules", href: "/pieces-industrielles/moules", icon: Box },
  { key: "electrique", href: "/pieces-industrielles/electrique", icon: Zap },
  { key: "hydraulique", href: "/pieces-industrielles/hydraulique", icon: Droplet },
  { key: "automatisation", href: "/services/automatisation-industrielle", icon: Bot },
  { key: "maintenance", href: "/services/maintenance-depannage", icon: Wrench },
  { key: "retrofit", href: "/services/renovation-machine-injection", icon: RefreshCw },
];

export async function MainCategories() {
  const t = await getTranslations("home.categories");

  return (
    <section className="py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map(({ key, href, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              className="group flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-ink)] text-white">
                <Icon size={20} />
              </span>
              <span className="text-sm font-bold text-[var(--color-ink)]">{t(`${key}.label`)}</span>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] opacity-0 transition-opacity group-hover:opacity-100">
                {t("viewMore")} <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
