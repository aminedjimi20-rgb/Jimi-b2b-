"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SellerForm } from "./SellerForm";
import { useLeadForm } from "./useLeadForm";
import { FieldWrapper, TextInput, TextArea, Select } from "./fields";
import { SuccessMessage, ErrorMessage, HoneypotField } from "./FormStatusMessages";
import { WhatsAppAlternative } from "./WhatsAppAlternative";
import { PhotoUploader } from "./MediaUploader";
import { Button } from "@/components/ui/Button";
import { wilayas } from "@/lib/wilayas";
import { Factory, Cog, Box, Send, ArrowLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type EquipmentType = "machine" | "piece" | "moule";

const TYPE_ICONS: Record<EquipmentType, LucideIcon> = {
  machine: Factory,
  piece: Cog,
  moule: Box,
};

export function SellEquipmentForm() {
  const t = useTranslations();
  const [equipmentType, setEquipmentType] = useState<EquipmentType | null>(null);

  if (equipmentType === null) {
    return (
      <div>
        <h2 className="mb-5 text-lg font-bold text-[var(--color-ink)]">
          {t("sellEquipment.typePrompt")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(["machine", "piece", "moule"] as EquipmentType[]).map((type) => {
            const Icon = TYPE_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => setEquipmentType(type)}
                className="flex flex-col items-start gap-3 rounded-xl border border-[var(--color-border)] bg-white p-5 text-start shadow-sm transition-all hover:-translate-y-1 hover:border-[var(--color-accent)] hover:shadow-lg"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-ink)] text-white">
                  <Icon size={20} />
                </span>
                <span className="text-base font-bold text-[var(--color-ink)]">
                  {t(`sellEquipment.types.${type}.label`)}
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {t(`sellEquipment.types.${type}.description`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setEquipmentType(null)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] hover:underline"
      >
        <ArrowLeft size={15} />
        {t("sellEquipment.changeType")}
      </button>

      {equipmentType === "machine" ? (
        <SellerForm />
      ) : (
        <PartOrMoldForm equipmentType={equipmentType} />
      )}
    </div>
  );
}

function PartOrMoldForm({ equipmentType }: { equipmentType: "piece" | "moule" }) {
  const t = useTranslations();
  const { status, submit } = useLeadForm("sell");
  const [photos, setPhotos] = useState<string[]>([]);

  const uploaderLabels = {
    addPhotos: t("mediaUploader.addPhotos"),
    addVideo: t("mediaUploader.addVideo"),
    uploading: t("mediaUploader.uploading"),
    mainPhotoBadge: t("mediaUploader.mainPhotoBadge"),
    setAsMain: t("mediaUploader.setAsMain"),
    remove: t("mediaUploader.remove"),
    replace: t("mediaUploader.replace"),
    maxReached: t("mediaUploader.maxReached"),
    notConfigured: t("mediaUploader.notConfigured"),
  };

  if (status === "success") {
    return (
      <SuccessMessage
        title={t("sellEquipment.successTitle")}
        message={t("sellEquipment.successMessage")}
      />
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <HoneypotField />
      <input type="hidden" name="equipmentType" value={equipmentType} />

      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)]">
          {t("sellEquipment.sections.equipment")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label={t("forms.fields.reference")}>
            <TextInput name="reference" placeholder="Siemens, SKF, moule 4 empreintes..." />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.priceWanted")}>
            <TextInput name="priceWanted" type="number" min={0} placeholder="50 000" />
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
        </div>
        <FieldWrapper label={t("forms.fields.description")} className="mt-4">
          <TextArea name="description" placeholder={t("forms.placeholders.description")} rows={4} />
        </FieldWrapper>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)]">
          {t("sellEquipment.sections.media")}
        </h2>
        <FieldWrapper label={t("forms.fields.photos")}>
          <PhotoUploader value={photos} onChange={setPhotos} labels={uploaderLabels} />
          <input type="hidden" name="photos" value={JSON.stringify(photos)} />
        </FieldWrapper>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)]">
          {t("sellEquipment.sections.contact")}
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
        </div>
      </div>

      {status === "error" && <ErrorMessage message={t("forms.errors.generic")} />}

      <Button type="submit" size="lg" icon={<Send size={17} />} className="self-start">
        {status === "submitting" ? t("forms.buttons.sending") : t("forms.buttons.sendRequest")}
      </Button>
      <WhatsAppAlternative message={t("whatsappMessages.sellEquipmentRequest")} />
    </form>
  );
}
