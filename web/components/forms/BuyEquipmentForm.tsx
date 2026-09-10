"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BuyerRequestForm } from "./BuyerRequestForm";
import { useLeadForm } from "./useLeadForm";
import { FieldWrapper, TextInput, TextArea, Select } from "./fields";
import { SuccessMessage, ErrorMessage, HoneypotField } from "./FormStatusMessages";
import { WhatsAppAlternative } from "./WhatsAppAlternative";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { wilayas } from "@/lib/wilayas";
import { Factory, Cog, Box, Wrench, LifeBuoy, Send, ArrowLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type BuyType = "machine" | "piece" | "moule" | "equipement" | "service";
/** "service" never sets state — its card is a plain Link to /contact — so
 *  the state type excludes it and TypeScript can narrow the render branch
 *  below without a redundant runtime check. */
type SelectableBuyType = Exclude<BuyType, "service">;

const TYPE_ICONS: Record<BuyType, LucideIcon> = {
  machine: Factory,
  piece: Cog,
  moule: Box,
  equipement: Wrench,
  service: LifeBuoy,
};

export function BuyEquipmentForm({ initialType = null }: { initialType?: SelectableBuyType | null }) {
  const t = useTranslations();
  const [buyType, setBuyType] = useState<SelectableBuyType | null>(initialType);

  if (buyType === null) {
    return (
      <div>
        <h2 className="mb-5 text-lg font-bold text-[var(--color-ink)]">
          {t("acheterHub.typePrompt")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(["machine", "piece", "moule", "equipement", "service"] as BuyType[]).map((type) => {
            const Icon = TYPE_ICONS[type];
            const cardClass =
              "flex flex-col items-start gap-3 rounded-xl border border-[var(--color-border)] bg-white p-5 text-start shadow-sm transition-all hover:-translate-y-1 hover:border-[var(--color-accent)] hover:shadow-lg";
            const cardContent = (
              <>
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-ink)] text-white">
                  <Icon size={20} />
                </span>
                <span className="text-base font-bold text-[var(--color-ink)]">
                  {t(`acheterHub.types.${type}.label`)}
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {t(`acheterHub.types.${type}.description`)}
                </span>
              </>
            );

            if (type === "service") {
              return (
                <Link key={type} href="/contact" className={cardClass}>
                  {cardContent}
                </Link>
              );
            }

            return (
              <button key={type} type="button" onClick={() => setBuyType(type)} className={cardClass}>
                {cardContent}
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
        onClick={() => setBuyType(null)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] hover:underline"
      >
        <ArrowLeft size={15} />
        {t("acheterHub.changeType")}
      </button>

      {buyType === "machine" ? <BuyerRequestForm /> : <GenericBuyRequestForm buyType={buyType} />}
    </div>
  );
}

export function GenericBuyRequestForm({
  buyType,
  defaultReference,
}: {
  buyType: "piece" | "moule" | "equipement";
  /** Préremplit le champ référence — utilisé sur une fiche produit pour
   *  identifier la pièce demandée sans que le client ait à la retaper. */
  defaultReference?: string;
}) {
  const t = useTranslations();
  const { status, submit } = useLeadForm("buy");

  if (status === "success") {
    return (
      <SuccessMessage title={t("acheterHub.successTitle")} message={t("acheterHub.successMessage")} />
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <HoneypotField />
      <input type="hidden" name="equipmentType" value={buyType} />

      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-accent)]">
          {t("acheterHub.sections.need")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldWrapper label={t("forms.fields.reference")}>
            <TextInput
              name="reference"
              defaultValue={defaultReference}
              placeholder="Siemens, SKF, moule 4 empreintes..."
            />
          </FieldWrapper>
          <FieldWrapper label={t("forms.fields.budget")}>
            <TextInput name="budget" type="number" min={0} placeholder="50 000" />
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
          {t("acheterHub.sections.contact")}
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
        {status === "submitting" ? t("forms.buttons.sending") : t("cta.sendMyRequest")}
      </Button>
      <WhatsAppAlternative message={t("whatsappMessages.buyRequest")} />
    </form>
  );
}
