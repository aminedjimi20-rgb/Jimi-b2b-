import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { Link } from "@/i18n/navigation";
import { Search, Tag, Wrench, ArrowRight } from "lucide-react";

const cards = [
  { key: "buy", href: "/acheter-machine", icon: Search, tone: "accent" },
  { key: "sell", href: "/vendre-machine", icon: Tag, tone: "accent2" },
  { key: "service", href: "/services", icon: Wrench, tone: "warn" },
] as const;

const toneClasses: Record<string, string> = {
  accent: "bg-blue-50 text-[var(--color-accent)]",
  accent2: "bg-teal-50 text-[var(--color-accent-2)]",
  warn: "bg-amber-50 text-[var(--color-warn)]",
};

export async function QuickCta() {
  const t = await getTranslations("quickCta");

  return (
    <section className="relative -mt-10 md:-mt-14">
      <Container>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map(({ key, href, icon: Icon, tone }) => (
            <Link
              key={key}
              href={href}
              className="group flex flex-col rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-lg shadow-slate-900/5 transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
                <Icon size={22} />
              </span>
              <h3 className="mt-4 text-lg font-bold text-[var(--color-ink)]">{t(`${key}.title`)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-muted)]">
                {t(`${key}.desc`)}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)]">
                {t(`${key}.action`)}
                <ArrowRight size={15} className="transition-transform rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
