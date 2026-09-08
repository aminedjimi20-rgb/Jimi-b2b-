import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/PageHeader";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacyPage" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: { canonical: "/politique-de-confidentialite" },
  };
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacyPage");
  const sections = t.raw("sections") as { heading: string; body: string }[];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <section className="py-12 md:py-16">
        <Container>
          <div className="mx-auto max-w-3xl">
            <p className="mb-8 text-sm text-[var(--color-text-muted)]">{t("updated")}</p>
            <div className="flex flex-col gap-8">
              {sections.map((section) => (
                <div key={section.heading}>
                  <h2 className="mb-2 text-lg font-bold text-[var(--color-ink)]">{section.heading}</h2>
                  <p className="text-base leading-relaxed text-[var(--color-text)]">{section.body}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
