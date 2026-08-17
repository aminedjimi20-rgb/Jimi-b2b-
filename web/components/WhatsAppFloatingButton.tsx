"use client";

import { useTranslations } from "next-intl";
import { buildWhatsAppLink } from "@/config/site.config";
import { MessageCircle } from "lucide-react";

export function WhatsAppFloatingButton() {
  const t = useTranslations("whatsappMessages");
  const link = buildWhatsAppLink(t("generalContact"));

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className="fixed bottom-5 end-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1fa855] text-white shadow-lg shadow-emerald-900/25 transition-transform hover:scale-105 active:scale-95 md:h-16 md:w-16"
    >
      <MessageCircle size={28} strokeWidth={2} />
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#1fa855]/40" />
    </a>
  );
}
