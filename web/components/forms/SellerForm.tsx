"use client";

import { useTranslations } from "next-intl";
import { useLeadForm } from "./useLeadForm";
import { FieldWrapper, TextInput, TextArea, Select } from "./fields";
import { SuccessMessage, ErrorMessage, HoneypotField } from "./FormStatusMessages";
import { WhatsAppAlternative } from "./WhatsAppAlternative";
import { Button } from "@/components/ui/Button";
import { wilayas } from "@/lib/wilayas";
import { Send } from "lucide-react";

export function SellerForm() {
  const t = useTranslations();
  const { status, submit } = useLeadForm("sell");

  if (status === "success") {
    return (
      <SuccessMessage title={t("sellPage.successTitle")} message={t("sellPage.successMessage")} />
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <HoneypotField />

      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)]">
          {t("sellPage.sections.machine")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label={t("forms.fields.brand")} required>
            <TextInput name="brand" required placeholder="Haitian, Engel, Arburg..." />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.model")} required>
            <TextInput name="model" required />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.tonnage")} required>
            <TextInput name="tonnage" type="number" min={0} required />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.year")}>
            <TextInput name="year" type="number" min={1970} max={2030} />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.state")}>
            <Select name="state" defaultValue="">
              <option value="">—</option>
              <option value="excellent">{t("forms.options.state.excellent")}</option>
              <option value="good">{t("forms.options.state.good")}</option>
              <option value="average">{t("forms.options.state.average")}</option>
              <option value="toRenovate">{t("forms.options.state.toRenovate")}</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.priceWanted")}>
            <TextInput name="priceWanted" type="number" min={0} placeholder="3 000 000" />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.wilaya")}>
            <Select name="wilaya" defaultValue="">
              <option value="">—</option>
              {wilayas.map((w) => (
                <option key={w.code} value={w.fr}>
                  {w.fr}
                </option>
              ))}
            </Select>
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.availability")}>
            <TextInput name="availability" placeholder="Immédiate, sous 2 semaines..." />
          </FieldWrapper>
        </div>
        <FieldWrapper label={t("forms.fields.description")} className="mt-4">
          <TextArea name="description" placeholder={t("forms.placeholders.description")} rows={4} />
        </FieldWrapper>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)]">
          {t("sellPage.sections.media")}
        </h2>
        <p className="mb-3 text-xs text-[var(--color-text-muted)]">
          {t("forms.fields.photos")}: joignez vos photos par WhatsApp ou email après l&apos;envoi de ce
          formulaire — ou collez un lien (Drive, Photos, etc.) ci-dessous.
        </p>
        <FieldWrapper label={t("forms.fields.video")}>
          <TextInput name="video" type="url" placeholder={t("forms.placeholders.video")} />
        </FieldWrapper>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)]">
          {t("sellPage.sections.contact")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label={t("forms.fields.name")} required>
            <TextInput name="name" required placeholder={t("forms.placeholders.name")} />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.phone")} required>
            <TextInput name="phone" type="tel" required placeholder={t("forms.placeholders.phone")} />
          </FieldWrapper>
        </div>
      </div>

      {status === "error" && <ErrorMessage message={t("forms.errors.generic")} />}

      <Button type="submit" size="lg" icon={<Send size={17} />} className="self-start">
        {status === "submitting" ? t("forms.buttons.sending") : t("cta.proposeMachine")}
      </Button>
      <WhatsAppAlternative message={t("whatsappMessages.sellRequest")} />
    </form>
  );
}
