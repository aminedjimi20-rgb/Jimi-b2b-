"use client";

import { useTranslations } from "next-intl";
import { useLeadForm } from "./useLeadForm";
import { FieldWrapper, TextInput, TextArea } from "./fields";
import { SuccessMessage, ErrorMessage, HoneypotField } from "./FormStatusMessages";
import { WhatsAppAlternative } from "./WhatsAppAlternative";
import { Button } from "@/components/ui/Button";
import { Send } from "lucide-react";

export function ContactForm() {
  const t = useTranslations();
  const { status, submit } = useLeadForm("contact");

  if (status === "success") {
    return (
      <SuccessMessage
        title={t("contactPage.successTitle")}
        message={t("contactPage.successMessage")}
      />
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <HoneypotField />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldWrapper label={t("forms.fields.name")} required>
          <TextInput name="name" required placeholder={t("forms.placeholders.name")} />
        </FieldWrapper>
        <FieldWrapper label={t("forms.fields.company")}>
          <TextInput name="company" placeholder={t("forms.placeholders.company")} />
        </FieldWrapper>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldWrapper label={t("forms.fields.phone")} required>
          <TextInput name="phone" type="tel" required placeholder={t("forms.placeholders.phone")} />
        </FieldWrapper>
        <FieldWrapper label={t("forms.fields.email")}>
          <TextInput name="email" type="email" placeholder={t("forms.placeholders.email")} />
        </FieldWrapper>
      </div>
      <FieldWrapper label={t("forms.fields.serviceType")}>
        <TextInput name="serviceType" placeholder={t("forms.fields.serviceType")} />
      </FieldWrapper>
      <FieldWrapper label={t("forms.fields.message")} required>
        <TextArea name="message" required placeholder={t("forms.placeholders.message")} />
      </FieldWrapper>

      {status === "error" && <ErrorMessage message={t("forms.errors.generic")} />}

      <Button type="submit" size="md" icon={<Send size={16} />} className="self-start">
        {status === "submitting" ? t("forms.buttons.sending") : t("cta.sendMyRequest")}
      </Button>
      <WhatsAppAlternative message={t("whatsappMessages.generalContact")} />
    </form>
  );
}
