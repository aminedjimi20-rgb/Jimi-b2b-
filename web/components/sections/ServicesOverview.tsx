import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Link } from "@/i18n/navigation";
import { Wrench, Cpu, LifeBuoy, RefreshCcw, ArrowRight } from "lucide-react";

const categories = [
  { key: "renovation", href: "/services/renovation-machine-injection", icon: Wrench },
  { key: "automation", href: "/services/automatisation-industrielle", icon: Cpu },
  { key: "maintenance", href: "/services/maintenance-depannage", icon: LifeBuoy },
  { key: "modernisation", href: "/services", icon: RefreshCcw },
] as const;

export async function ServicesOverview() {
  const t = await getTranslations();

  return (
    <section className="bg-[var(--color-surface-2)] py-20 md:py-28">
      <Container>
        <SectionHeading
          eyebrow={t("nav.services")}
          title={t("home.services.title")}
          subtitle={t("home.services.subtitle")}
        />

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map(({ key, href, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              className="group flex flex-col rounded-xl border border-[var(--color-border)] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[var(--color-accent)] hover:shadow-lg"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-ink)] text-white">
                <Icon size={20} />
              </span>
              <h3 className="mt-4 text-base font-bold text-[var(--color-ink)]">
                {t(`services.categories.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                {t(`services.categories.${key}.desc`)}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)]">
                {t("cta.learnMore")}
                <ArrowRight size={14} className="transition-transform rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
