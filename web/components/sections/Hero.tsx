import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { buildWhatsAppLink } from "@/config/site.config";
import { ArrowRight, MessageCircle, ShieldCheck, Tag } from "lucide-react";

export async function Hero() {
  const t = await getTranslations();
  const waLink = buildWhatsAppLink(t("whatsappMessages.generalContact"));

  return (
    <section className="relative overflow-hidden bg-[var(--color-ink)] text-white">
      <div className="industrial-grid-bg absolute inset-0 opacity-60" />
      <div
        className="absolute -end-40 -top-40 h-[520px] w-[520px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-accent), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-40 -start-24 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-accent-2), transparent 70%)" }}
      />

      <Container className="relative py-20 md:py-28 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="animate-fade-up mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200">
            <ShieldCheck size={14} className="text-[var(--color-accent-2)]" />
            {t("hero.badge")}
          </span>

          <h1
            className="animate-fade-up mt-6 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl lg:text-[3.4rem]"
            style={{ animationDelay: "80ms" }}
          >
            {t("hero.title")}
          </h1>

          <p
            className="animate-fade-up mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg"
            style={{ animationDelay: "150ms" }}
          >
            {t("hero.subtitle")}
          </p>

          <div
            className="animate-fade-up mt-9 flex flex-col flex-wrap items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "220ms" }}
          >
            <Button href="/machines" size="lg" icon={<ArrowRight size={18} />}>
              {t("cta.viewMachines")}
            </Button>
            <Button href="/acheter-machine" size="lg" variant="outline" className="!bg-transparent !text-white !border-white/25 hover:!border-white">
              {t("cta.requestMachine")}
            </Button>
            <Button href={waLink} external size="lg" variant="whatsapp" icon={<MessageCircle size={18} />}>
              {t("cta.whatsapp")}
            </Button>
            <Button
              href="/vendre-equipement"
              size="lg"
              variant="primary"
              className="!bg-[var(--color-accent-2)] hover:!bg-[#00968a]"
              icon={<Tag size={18} />}
            >
              {t("cta.sellEquipment")}
            </Button>
          </div>

          <div
            className="animate-fade-up mx-auto mt-14 grid max-w-2xl grid-cols-1 gap-6 border-t border-white/10 pt-8 sm:grid-cols-3"
            style={{ animationDelay: "280ms" }}
          >
            {[
              [t("hero.stat1Value"), t("hero.stat1Label")],
              [t("hero.stat2Value"), t("hero.stat2Label")],
              [t("hero.stat3Value"), t("hero.stat3Label")],
            ].map(([value, label], i) => (
              <div key={i}>
                <p className="text-xl font-bold text-white md:text-2xl">{value}</p>
                <p className="mt-1 text-xs text-slate-400 md:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
