"use client";

import { useTranslations } from "next-intl";
import { buildWhatsAppLink } from "@/config/site.config";
import { MessageCircle } from "lucide-react";

export function WhatsAppAlternative({ message }: { message: string }) {
  const t = useTranslations("forms");
  const link = buildWhatsAppLink(message);

  return (
    <p className="mt-4 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
      {t("whatsappAlternative")}{" "}
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-[#1fa855] hover:underline"
      >
        <MessageCircle size={14} /> WhatsApp
      </a>
    </p>
  );
}
