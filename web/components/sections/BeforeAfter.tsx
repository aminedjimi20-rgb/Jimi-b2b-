import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";

export async function BeforeAfter() {
  const t = await getTranslations("home.beforeAfter");
  const items = t.raw("items") as { before: string; after: string }[];

  return (
    <section className="py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow="Résultats" title={t("title")} subtitle={t("subtitle")} />

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white"
            >
              <div className="flex items-center gap-3 bg-slate-100 px-5 py-4">
                <AlertTriangle size={18} className="shrink-0 text-slate-400" />
                <p className="text-sm font-medium text-slate-600">{item.before}</p>
              </div>
              <div className="flex justify-center bg-white py-1.5">
                <ArrowRight size={16} className="rotate-90 text-[var(--color-accent)]" />
              </div>
              <div className="flex items-center gap-3 bg-blue-50 px-5 py-4">
                <CheckCircle2 size={18} className="shrink-0 text-[var(--color-accent)]" />
                <p className="text-sm font-semibold text-[var(--color-ink)]">{item.after}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
