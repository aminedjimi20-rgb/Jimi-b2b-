"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { buildWhatsAppLink, siteConfig } from "@/config/site.config";
import { MessageCircle, Phone, X } from "lucide-react";

export function WhatsAppFloatingButton() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const waLink = buildWhatsAppLink(t("whatsappMessages.generalContact"));

  return (
    <div className="fixed bottom-5 end-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="animate-fade-up flex flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-white p-2 shadow-lg">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
          >
            <MessageCircle size={17} className="text-[#1fa855]" /> WhatsApp
          </a>
          <a
            href={`tel:${siteConfig.contact.phoneHref}`}
            className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
          >
            <Phone size={17} className="text-[var(--color-accent)]" /> {t("cta.callNow")}
          </a>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("cta.callNow") : "WhatsApp"}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#1fa855] text-white shadow-lg shadow-emerald-900/25 transition-transform hover:scale-105 active:scale-95 md:h-16 md:w-16"
      >
        {open ? <X size={26} /> : <MessageCircle size={28} strokeWidth={2} />}
        {!open && <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#1fa855]/40" />}
      </button>
    </div>
  );
}
