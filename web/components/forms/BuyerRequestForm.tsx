"use client";

import { useTranslations } from "next-intl";
import { useLeadForm } from "./useLeadForm";
import { FieldWrapper, TextInput, TextArea, Select } from "./fields";
import { SuccessMessage, ErrorMessage, HoneypotField } from "./FormStatusMessages";
import { WhatsAppAlternative } from "./WhatsAppAlternative";
import { Button } from "@/components/ui/Button";
import { wilayas } from "@/lib/wilayas";
import { Send } from "lucide-react";

export function BuyerRequestForm() {
  const t = useTranslations();
  const { status, submit } = useLeadForm("buy");

  if (status === "success") {
    return (
      <SuccessMessage title={t("buyPage.successTitle")} message={t("buyPage.successMessage")} />
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <HoneypotField />

      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)]">
          {t("buyPage.sections.criteria")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label={t("forms.fields.machineType")}>
            <Select name="machineType" defaultValue="injection">
              <option value="injection">{t("forms.options.machineType.injection")}</option>
              <option value="blowMolding">{t("forms.options.machineType.blowMolding")}</option>
              <option value="other">{t("forms.options.machineType.other")}</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.brand")}>
            <TextInput name="brand" placeholder="Haitian, Engel, Arburg..." />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.tonnageMin")}>
            <TextInput name="tonnageMin" type="number" min={0} placeholder="100" />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.tonnageMax")}>
            <TextInput name="tonnageMax" type="number" min={0} placeholder="500" />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.yearMin")}>
            <TextInput name="yearMin" type="number" min={1980} max={2030} placeholder="2010" />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.driveType")}>
            <Select name="driveType" defaultValue="">
              <option value="">{t("forms.options.driveType.indifferent")}</option>
              <option value="hydraulic">{t("forms.options.driveType.hydraulic")}</option>
              <option value="servo">{t("forms.options.driveType.servo")}</option>
              <option value="hybrid">{t("forms.options.driveType.hybrid")}</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.budgetMin")}>
            <TextInput name="budgetMin" type="number" min={0} placeholder="1 000 000" />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.budgetMax")}>
            <TextInput name="budgetMax" type="number" min={0} placeholder="6 000 000" />
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
          <FieldWrapper label={t("forms.fields.location")}>
            <Select name="wilaya" defaultValue="">
              <option value="">—</option>
              {wilayas.map((w) => (
                <option key={w.code} value={w.fr}>
                  {w.fr}
                </option>
              ))}
            </Select>
          </FieldWrapper>
        </div>
        <FieldWrapper label={t("forms.fields.specificNeed")} className="mt-4">
          <TextArea name="specificNeed" placeholder={t("forms.placeholders.specificNeed")} rows={3} />
        </FieldWrapper>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)]">
          {t("buyPage.sections.contact")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label={t("forms.fields.name")} required>
            <TextInput name="name" required placeholder={t("forms.placeholders.name")} />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.phone")} required>
            <TextInput name="phone" type="tel" required placeholder={t("forms.placeholders.phone")} />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.whatsapp")}>
            <TextInput name="whatsapp" type="tel" placeholder={t("forms.placeholders.phone")} />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.email")}>
            <TextInput name="email" type="email" placeholder={t("forms.placeholders.email")} />
          </FieldWrapper>
        </div>
      </div>

      {status === "error" && <ErrorMessage message={t("forms.errors.generic")} />}

      <Button type="submit" size="lg" icon={<Send size={17} />} className="self-start">
        {status === "submitting" ? t("forms.buttons.sending") : t("cta.sendMyRequest")}
      </Button>
      <WhatsAppAlternative message={t("whatsappMessages.buyRequest")} />
    </form>
  );
}
