import { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <section className="border-b border-[var(--color-border)] bg-[var(--color-ink)] py-14 text-white md:py-20">
      <Container>
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent-2)]">
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
          {subtitle && <p className="mt-4 text-base leading-relaxed text-slate-300 md:text-lg">{subtitle}</p>}
        </div>
      </Container>
    </section>
  );
}
