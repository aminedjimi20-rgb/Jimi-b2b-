"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { FieldWrapper, TextInput, TextArea, Select } from "@/components/forms/fields";
import { SuccessMessage, ErrorMessage, HoneypotField } from "@/components/forms/FormStatusMessages";
import { Button } from "@/components/ui/Button";
import { wilayas } from "@/lib/wilayas";
import { MessageCircle } from "lucide-react";

type Status = "idle" | "open" | "submitting" | "success" | "error";

export function MachineInterestForm({
  machineId,
  machineLabel,
}: {
  machineId: string;
  machineLabel: string;
}) {
  const t = useTranslations();
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const website = String(formData.get("website") ?? "");

    const payload: Record<string, unknown> = { machineId, website };
    formData.forEach((value, key) => {
      if (key !== "website" && typeof value === "string" && value.trim() !== "") {
        payload[key] = value;
      }
    });

    try {
      const res = await fetch("/api/machine-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("request_failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <SuccessMessage
        title={t("machineDetail.interestSuccessTitle")}
        message={t("machineDetail.interestSuccessMessage")}
      />
    );
  }

  if (status === "idle") {
    return (
      <Button
        type="button"
        onClick={() => setStatus("open")}
        icon={<MessageCircle size={17} />}
        className="w-full"
      >
        {t("cta.imInterested")}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <HoneypotField />
      <FieldWrapper label={t("forms.fields.name")} required>
        <TextInput name="name" required placeholder={t("forms.placeholders.name")} />
      </FieldWrapper>
      <FieldWrapper label={t("forms.fields.company")}>
        <TextInput name="company" placeholder={t("forms.placeholders.company")} />
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
      <FieldWrapper label={t("forms.fields.message")}>
        <TextArea
          name="message"
          rows={3}
          defaultValue={t("machineDetail.interestDefaultMessage", { machine: machineLabel })}
        />
      </FieldWrapper>

      {status === "error" && <ErrorMessage message={t("forms.errors.generic")} />}

      <Button type="submit" className="mt-1">
        {status === "submitting" ? t("forms.buttons.sending") : t("cta.sendMyRequest")}
      </Button>
    </form>
  );
}
