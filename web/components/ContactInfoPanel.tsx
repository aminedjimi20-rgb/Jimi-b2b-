import { getTranslations, getLocale } from "next-intl/server";
import { siteConfig, buildWhatsAppLink } from "@/config/site.config";
import type { Locale } from "@/i18n/routing";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";

export async function ContactInfoPanel() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const waLink = buildWhatsAppLink(t("whatsappMessages.generalContact"));

  const rows = [
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: siteConfig.contact.phoneDisplay,
      href: waLink,
      external: true,
      tone: "text-[#1fa855]",
    },
    {
      icon: Phone,
      label: t("forms.fields.phone"),
      value: siteConfig.contact.phoneDisplay,
      href: `tel:${siteConfig.contact.phoneHref}`,
      tone: "text-[var(--color-accent)]",
    },
    {
      icon: Mail,
      label: t("forms.fields.email"),
      value: siteConfig.contact.email,
      href: `mailto:${siteConfig.contact.email}`,
      tone: "text-[var(--color-accent)]",
    },
  ];

  return (
    <div className="flex h-full flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-ink)] p-6 text-white">
      <div>
        <h3 className="text-lg font-bold">{t("contactPage.infoTitle")}</h3>
        <ul className="mt-6 space-y-5">
          {rows.map((row) => (
            <li key={row.label} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <row.icon size={16} className={row.tone} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{row.label}</p>
                <a
                  href={row.href}
                  target={row.external ? "_blank" : undefined}
                  rel={row.external ? "noopener noreferrer" : undefined}
                  className="text-sm font-medium text-white hover:underline"
                >
                  {row.value}
                </a>
              </div>
            </li>
          ))}
          <li className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <MapPin size={16} className="text-[var(--color-accent-2)]" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {t("forms.fields.wilaya")}
              </p>
              <p className="text-sm font-medium text-white">{siteConfig.contact.addressLine[locale]}</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
