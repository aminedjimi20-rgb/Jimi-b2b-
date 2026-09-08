import { siteConfig } from "@/config/site.config";
import { ServiceVideosSettings } from "./ServiceVideosSettings";
import { BusinessInfoSettings } from "./BusinessInfoSettings";
import type { ServiceVideos } from "@/lib/serviceVideos";
import type { BusinessInfo } from "@/lib/businessInfoStore";
import { AlertTriangle, Settings2 } from "lucide-react";

export function SettingsTab({
  usingDefaultPassword,
  initialServiceVideos,
  initialBusinessInfo,
}: {
  usingDefaultPassword: boolean;
  initialServiceVideos: ServiceVideos;
  initialBusinessInfo: BusinessInfo;
}) {
  const defaultPwd = usingDefaultPassword;

  const rows: [string, string][] = [
    ["Nom de l'entreprise", siteConfig.companyName],
    ["WhatsApp (numéro international)", siteConfig.contact.whatsappNumber],
    ["Téléphone affiché", siteConfig.contact.phoneDisplay],
    ["Email", siteConfig.contact.email],
    ["Ville de base", siteConfig.contact.baseCity],
    ["URL du site", siteConfig.seo.siteUrl],
  ];

  return (
    <div className="flex flex-col gap-6">
      {defaultPwd && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            Vous utilisez le mot de passe administrateur par défaut. Définissez la variable
            d&apos;environnement <code className="rounded bg-amber-100 px-1.5 py-0.5">ADMIN_PASSWORD</code>{" "}
            dans <code className="rounded bg-amber-100 px-1.5 py-0.5">.env.local</code> avant la mise en
            production.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Settings2 size={18} className="text-[var(--color-accent)]" />
          <h2 className="text-base font-bold text-[var(--color-ink)]">
            Informations de l&apos;entreprise
          </h2>
        </div>
        <p className="mb-5 text-sm text-[var(--color-text-muted)]">
          Ces informations sont centralisées dans le fichier{" "}
          <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5">
            config/site.config.ts
          </code>{" "}
          (ou les variables d&apos;environnement correspondantes). Modifiez-les à cet endroit unique
          : elles se mettent à jour automatiquement partout sur le site.
        </p>
        <dl className="divide-y divide-[var(--color-border)]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
              <dt className="text-sm text-[var(--color-text-muted)]">{label}</dt>
              <dd className="text-sm font-medium text-[var(--color-ink)]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <ServiceVideosSettings initialServiceVideos={initialServiceVideos} />

      <BusinessInfoSettings initialBusinessInfo={initialBusinessInfo} />
    </div>
  );
}
