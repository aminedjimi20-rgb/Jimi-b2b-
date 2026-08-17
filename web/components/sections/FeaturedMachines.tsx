import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { MachineCard } from "@/components/MachineCard";
import { getFeaturedMachines } from "@/lib/data";
import { Info } from "lucide-react";

export async function FeaturedMachines() {
  const t = await getTranslations("home.featuredMachines");
  const machines = await getFeaturedMachines(6);

  return (
    <section className="py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow="Machines" title={t("title")} subtitle={t("subtitle")} />

        <div className="mx-auto mt-6 flex max-w-2xl items-start gap-2.5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>{t("demoNotice")}</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {machines.map((machine, i) => (
            <MachineCard key={machine.id} machine={machine} index={i} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button href="/machines" variant="outline">
            {t("viewAll")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
