"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLeadForm } from "./useLeadForm";
import { FieldWrapper, TextInput, TextArea } from "./fields";
import { SuccessMessage, ErrorMessage, HoneypotField } from "./FormStatusMessages";
import { Button } from "@/components/ui/Button";
import { Send } from "lucide-react";

export function OfferForm({ wantedListingId, wantedTitle }: { wantedListingId: string; wantedTitle: string }) {
  const t = useTranslations();
  const { status, submit } = useLeadForm("offer");
  const [open, setOpen] = useState(false);

  if (status === "success") {
    return (
      <SuccessMessage title={t("wanted.offerSuccessTitle")} message={t("wanted.offerSuccessMessage")} />
    );
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        {t("wanted.offerCta")}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg bg-[var(--color-surface-2)] p-4">
      <HoneypotField />
      <input type="hidden" name="wantedListingId" value={wantedListingId} />
      <input type="hidden" name="wantedTitle" value={wantedTitle} />

      <FieldWrapper label={t("forms.fields.name")} required>
        <TextInput name="name" required placeholder={t("forms.placeholders.name")} />
      </FieldWrapper>
      <FieldWrapper label={t("forms.fields.phone")} required>
        <TextInput name="phone" type="tel" required placeholder={t("forms.placeholders.phone")} />
      </FieldWrapper>
      <FieldWrapper label={t("forms.fields.message")}>
        <TextArea name="message" rows={3} placeholder={t("wanted.offerMessagePlaceholder")} />
      </FieldWrapper>

      {status === "error" && <ErrorMessage message={t("forms.errors.generic")} />}

      <Button type="submit" size="sm" icon={<Send size={15} />} className="self-start">
        {status === "submitting" ? t("forms.buttons.sending") : t("wanted.offerSubmit")}
      </Button>
    </form>
  );
}
