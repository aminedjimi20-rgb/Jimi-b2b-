"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { Link } from "@/i18n/navigation";
import { AlertTriangle, RotateCw, ArrowLeft } from "lucide-react";

export default function LocaleError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("errorBoundary");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="flex min-h-[60vh] items-center py-20">
      <Container>
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-ink)] text-white">
            <AlertTriangle size={26} />
          </span>
          <h1 className="mt-6 text-2xl font-bold text-[var(--color-ink)]">{t("title")}</h1>
          <p className="mt-3 text-[var(--color-text-muted)]">{t("subtitle")}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#0b58ad]"
            >
              <RotateCw size={16} />
              {t("retry")}
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-5 py-3 text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              <ArrowLeft size={16} className="rtl:rotate-180" />
              {t("home")}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
