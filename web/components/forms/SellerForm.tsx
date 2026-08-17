"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useListingSubmission } from "./useListingSubmission";
import { FieldWrapper, TextInput, TextArea, Select } from "./fields";
import { SuccessMessage, ErrorMessage, HoneypotField } from "./FormStatusMessages";
import { WhatsAppAlternative } from "./WhatsAppAlternative";
import { PhotoUploader, VideoUploader } from "./MediaUploader";
import { Button } from "@/components/ui/Button";
import { wilayas } from "@/lib/wilayas";
import { Send } from "lucide-react";

export function SellerForm() {
  const t = useTranslations();
  const { status, submit } = useListingSubmission();
  const [photos, setPhotos] = useState<string[]>([]);
  const [video, setVideo] = useState<string | null>(null);

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
        <FieldWrapper label={t("forms.fields.photos")} className="mb-4">
          <PhotoUploader value={photos} onChange={setPhotos} labels={uploaderLabels} />
          <input type="hidden" name="photos" value={JSON.stringify(photos)} />
        </FieldWrapper>
        <FieldWrapper label={t("forms.fields.video")}>
          <VideoUploader value={video} onChange={setVideo} labels={uploaderLabels} />
          <input type="hidden" name="video" value={video ?? ""} />
        </FieldWrapper>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)]">
          {t("sellPage.sections.contact")}
        </h2>
        <p className="mb-4 text-xs text-[var(--color-text-muted)]">{t("sellPage.privacyNote")}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
