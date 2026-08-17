import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CheckCircle2, ShieldAlert } from "lucide-react";

export async function Intermediation() {
  const t = await getTranslations("home.intermediation");
  const buyerItems = t.raw("buyers.items") as string[];
  const sellerItems = t.raw("sellers.items") as string[];
  const roleItems = t.raw("ourRole.items") as string[];

  return (
    <section className="bg-[var(--color-ink)] py-20 text-white md:py-28">
      <Container>
        <SectionHeading
          eyebrow="Brokerage"
          title={<span className="text-white">{t("title")}</span>}
          subtitle={<span className="text-slate-300">{t("subtitle")}</span>}
        />

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-bold text-white">{t("buyers.title")}</h3>
            <ul className="mt-4 space-y-3">
              {buyerItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--color-accent-2)]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-bold text-white">{t("sellers.title")}</h3>
            <ul className="mt-4 space-y-3">
              {sellerItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--color-accent-2)]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-6">
            <h3 className="text-lg font-bold text-white">{t("ourRole.title")}</h3>
            <ul className="mt-4 space-y-3">
              {roleItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-200">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-2xl items-start gap-2.5 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <p>{t("disclaimer")}</p>
        </div>
      </Container>
    </section>
  );
}
