import { Link } from "@/i18n/navigation";
import { Factory, Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import { siteConfig, buildWhatsAppLink } from "@/config/site.config";
import { getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations();
  const year = new Date().getFullYear();
  const waLink = buildWhatsAppLink(t("whatsappMessages.generalContact"));

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-ink)] text-slate-300">
      <div className="container-jimi grid grid-cols-1 gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-white">
              <Factory size={20} />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-white">JIMI</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
            {t("footer.description")}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-white">
            {t("footer.navTitle")}
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/machines" className="hover:text-white">{t("nav.machines")}</Link></li>
            <li><Link href="/acheter-machine" className="hover:text-white">{t("nav.buy")}</Link></li>
            <li><Link href="/vendre-machine" className="hover:text-white">{t("nav.sell")}</Link></li>
            <li><Link href="/realisations" className="hover:text-white">{t("nav.realisations")}</Link></li>
            <li><Link href="/blog" className="hover:text-white">{t("nav.blog")}</Link></li>
            <li><Link href="/contact" className="hover:text-white">{t("nav.contact")}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-white">
            {t("footer.servicesTitle")}
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link href="/services/renovation-machine-injection" className="hover:text-white">
                {t("nav.servicesMenu.renovation")}
              </Link>
            </li>
            <li>
              <Link href="/services/automatisation-industrielle" className="hover:text-white">
                {t("nav.servicesMenu.automation")}
              </Link>
            </li>
            <li>
              <Link href="/services/maintenance-depannage" className="hover:text-white">
                {t("nav.servicesMenu.maintenance")}
              </Link>
            </li>
            <li>
              <Link href="/services" className="hover:text-white">
                {t("services.pageTitle")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-white">
            {t("footer.contactTitle")}
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2.5">
              <MessageCircle size={16} className="mt-0.5 shrink-0 text-[#25d366]" />
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                WhatsApp
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Phone size={16} className="mt-0.5 shrink-0 text-[var(--color-accent-2)]" />
              <a href={`tel:${siteConfig.contact.phoneHref}`} className="hover:text-white">
                {siteConfig.contact.phoneDisplay}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Mail size={16} className="mt-0.5 shrink-0 text-[var(--color-accent-2)]" />
              <a href={`mailto:${siteConfig.contact.email}`} className="hover:text-white">
                {siteConfig.contact.email}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <MapPin size={16} className="mt-0.5 shrink-0 text-[var(--color-accent-2)]" />
              <span>{t("hero.stat3Label")}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-jimi flex flex-col items-center justify-between gap-2 py-5 text-xs text-slate-500 sm:flex-row">
          <p>© {year} {siteConfig.companyName} — {t("footer.rights")}</p>
          <p>{t("footer.madeWith")}</p>
        </div>
      </div>
    </footer>
  );
}
