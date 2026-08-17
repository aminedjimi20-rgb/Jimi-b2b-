import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { buildWhatsAppLink } from "@/config/site.config";
import { MessageCircle, Mail } from "lucide-react";

export async function FinalCta() {
  const t = await getTranslations("home.finalCta");
  const tw = await getTranslations("whatsappMessages");
  const waLink = buildWhatsAppLink(tw("generalContact"));

  return (
    <section className="relative overflow-hidden bg-[var(--color-ink)] py-16 text-white md:py-20">
      <div className="diagonal-accent absolute inset-x-0 top-0 h-1.5 opacity-80" />
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h2>
          <p className="mt-3 text-slate-300">{t("subtitle")}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href={waLink} external size="lg" variant="whatsapp" icon={<MessageCircle size={18} />}>
              {t("whatsapp")}
            </Button>
            <Button
              href="/contact"
              size="lg"
              variant="outline"
              className="!bg-transparent !text-white !border-white/25 hover:!border-white"
              icon={<Mail size={18} />}
            >
              {t("contact")}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
