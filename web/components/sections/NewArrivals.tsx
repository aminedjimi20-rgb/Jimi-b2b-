import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MachineCard } from "@/components/MachineCard";
import { PartCard } from "@/components/PartCard";
import { getLatestMachines, getLatestParts } from "@/lib/data";

export async function NewArrivals() {
  const t = await getTranslations("home.newArrivals");
  const [machines, parts] = await Promise.all([getLatestMachines(4), getLatestParts(4)]);

  if (machines.length === 0 && parts.length === 0) return null;

  return (
    <section className="bg-[var(--color-surface-2)] py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

        {machines.length > 0 && (
          <div className="mt-10">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">
              {t("machinesLabel")}
            </h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {machines.map((machine, i) => (
                <MachineCard key={machine.id} machine={machine} index={i} />
              ))}
            </div>
          </div>
        )}

        {parts.length > 0 && (
          <div className="mt-10">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">
              {t("partsLabel")}
            </h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {parts.map((part) => (
                <PartCard key={part.id} part={part} />
              ))}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
