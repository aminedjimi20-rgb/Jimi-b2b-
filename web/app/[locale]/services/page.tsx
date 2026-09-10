import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Wrench, Cpu, LifeBuoy, RefreshCcw, CheckCircle2 } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "services" });
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle"),
    alternates: buildAlternates("/services", locale),
  };
}

const categories = [
  { key: "renovation", href: "/services/renovation-machine-injection", icon: Wrench },
  { key: "automation", href: "/services/automatisation-industrielle", icon: Cpu },
  { key: "maintenance", href: "/services/maintenance-depannage", icon: LifeBuoy },
] as const;

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services");

  return (
    <>
      <PageHeader eyebrow={t("pageTitle")} title={t("pageTitle")} subtitle={t("pageSubtitle")} />

      <section className="py-16 md:py-20">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {categories.map(({ key, href, icon: Icon }) => {
              const items = t.raw(`categories.${key}.items`) as string[];
              return (
                <div
                  key={key}
                  className="flex flex-col rounded-xl border border-[var(--color-border)] bg-white p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-ink)] text-white">
                    <Icon size={20} />
                  </span>
                  <h2 className="mt-4 text-lg font-bold text-[var(--color-ink)]">
                    {t(`categories.${key}.title`)}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                    {t(`categories.${key}.desc`)}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {items.map((item) => (
                      <li
                        key={item}
                        className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button href={href} variant="outline" size="sm" className="mt-5 self-start">
                    {t("cta.button")}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--color-accent)] ring-1 ring-[var(--color-border)]">
                <RefreshCcw size={20} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-[var(--color-ink)]">
                  {t("categories.modernisation.title")}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {t("categories.modernisation.desc")}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-4 rounded-xl bg-[var(--color-ink)] px-6 py-10 text-center text-white">
            <CheckCircle2 size={26} className="text-[var(--color-accent-2)]" />
            <h2 className="text-xl font-bold">{t("cta.title")}</h2>
            <p className="max-w-md text-sm text-slate-300">{t("cta.subtitle")}</p>
            <Button href="/contact">{t("cta.button")}</Button>
          </div>
        </Container>
      </section>
    </>
  );
}
