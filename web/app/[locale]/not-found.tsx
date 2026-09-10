import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Factory, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <section className="flex min-h-[60vh] items-center py-20">
      <Container>
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-ink)] text-white">
            <Factory size={26} />
          </span>
          <p className="mt-6 text-6xl font-extrabold tracking-tight text-[var(--color-border)]">
            404
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--color-ink)]">{t("title")}</h1>
          <p className="mt-3 text-[var(--color-text-muted)]">{t("subtitle")}</p>
          <Button href="/" className="mt-8" icon={<ArrowLeft size={16} className="rtl:rotate-180" />}>
            {t("cta")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
