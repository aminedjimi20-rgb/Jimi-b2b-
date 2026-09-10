import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Wrench, Factory, Cpu, Search, Handshake, Map, LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  wrench: Wrench,
  factory: Factory,
  cpu: Cpu,
  search: Search,
  handshake: Handshake,
  map: Map,
};

export async function WhyUs() {
  const t = await getTranslations("home.whyUs");
  const items = t.raw("items") as { icon: string; title: string; desc: string }[];

  return (
    <section className="py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow="JIMI Industrie" title={t("title")} subtitle={t("subtitle")} />

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => {
            const Icon = ICONS[item.icon] ?? Wrench;
            return (
              <div
                key={i}
                className="rounded-xl border border-[var(--color-border)] bg-white p-6 transition-shadow hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-[var(--color-accent)]">
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 text-base font-bold text-[var(--color-ink)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
