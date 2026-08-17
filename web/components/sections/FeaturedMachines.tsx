import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { MachineCard } from "@/components/MachineCard";
import { EmptyState } from "@/components/EmptyState";
import { getFeaturedMachines } from "@/lib/data";
import { buildWhatsAppLink } from "@/config/site.config";
import { Factory } from "lucide-react";

export async function FeaturedMachines() {
  const t = await getTranslations("home.featuredMachines");
  const tw = await getTranslations("whatsappMessages");
  const tc = await getTranslations("cta");
  const machines = await getFeaturedMachines(6);

  return (
    <section className="py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow="Machines" title={t("title")} subtitle={t("subtitle")} />

        {machines.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xl">
            <EmptyState
              icon={Factory}
              title={t("emptyTitle")}
              subtitle={t("emptySubtitle")}
              ctaHref="/acheter-machine"
              ctaLabel={tc("requestMachine")}
              whatsappHref={buildWhatsAppLink(tw("buyRequest"))}
              whatsappLabel={tc("whatsapp")}
            />
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {machines.map((machine, i) => (
              <MachineCard key={machine.id} machine={machine} index={i} />
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Button href="/machines" variant="outline">
            {t("viewAll")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
