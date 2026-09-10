import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppFloatingButton } from "@/components/WhatsAppFloatingButton";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { HtmlAttributes } from "@/components/HtmlAttributes";
import { siteConfig } from "@/config/site.config";
import { buildAlternates, absoluteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-ibm-plex-arabic",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    metadataBase: new URL(siteConfig.seo.siteUrl),
    title: {
      default: t("defaultTitle"),
      template: `%s | ${siteConfig.companyName}`,
    },
    description: t("defaultDescription"),
    alternates: buildAlternates("", locale),
    openGraph: {
      title: t("defaultTitle"),
      description: t("defaultDescription"),
      url: siteConfig.seo.siteUrl,
      siteName: siteConfig.companyName,
      locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("defaultTitle"),
      description: t("defaultDescription"),
    },
    robots: {
      index: true,
      follow: true,
    },
    // Rempli uniquement si la variable d'environnement est définie (token
    // réel fourni via Google Search Console → Paramètres → Propriété →
    // Vérification par balise HTML). Jamais de valeur inventée : sans la
    // variable, cette clé est absente et aucune balise n'est générée.
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
      : {}),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <NextIntlClientProvider>
      <div
        dir={dir}
        lang={locale}
        className={`${inter.variable} ${cairo.variable} flex min-h-screen flex-col`}
      >
        <HtmlAttributes locale={locale} dir={dir} />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": ["Organization", "LocalBusiness"],
            "@id": `${siteConfig.seo.siteUrl}/#organization`,
            name: siteConfig.companyName,
            alternateName: siteConfig.companyShortName,
            url: siteConfig.seo.siteUrl,
            image: absoluteUrl("/opengraph-image", locale),
            description:
              "Machines, pièces industrielles, moules et automatisation : vente, achat, maintenance et rénovation d'équipements industriels en Algérie.",
            telephone: siteConfig.contact.phoneDisplay,
            email: siteConfig.contact.email,
            address: {
              "@type": "PostalAddress",
              addressLocality: siteConfig.contact.baseCity,
              addressCountry: "DZ",
            },
            areaServed: [
              { "@type": "Country", name: "Algérie" },
              { "@type": "City", name: "Alger" },
              { "@type": "City", name: "Oran" },
              { "@type": "City", name: "Sétif" },
              { "@type": "City", name: "Blida" },
              { "@type": "City", name: "Constantine" },
              { "@type": "City", name: "Annaba" },
            ],
          }}
        />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsAppFloatingButton />
        <PushNotificationManager />
      </div>
    </NextIntlClientProvider>
  );
}
