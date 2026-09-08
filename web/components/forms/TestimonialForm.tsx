"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { FieldWrapper, TextInput, TextArea } from "./fields";
import { SuccessMessage, ErrorMessage, HoneypotField } from "./FormStatusMessages";
import { Button } from "@/components/ui/Button";
import { Star, Send } from "lucide-react";
import clsx from "clsx";

type Status = "idle" | "submitting" | "success" | "error";

export function TestimonialForm() {
  const t = useTranslations();
  const [status, setStatus] = useState<Status>("idle");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const website = String(formData.get("website") ?? "");

    const payload = {
      name: String(formData.get("name") ?? ""),
      company: String(formData.get("company") ?? ""),
      message: String(formData.get("message") ?? ""),
      rating,
      website,
    };

    try {
      const res = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("request_failed");
      setStatus("success");
      form.reset();
      setRating(5);
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <SuccessMessage
        title={t("testimonialForm.successTitle")}
        message={t("testimonialForm.successMessage")}
      />
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <HoneypotField />

      <FieldWrapper label={t("testimonialForm.rating")} required>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} / 5`}
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5"
            >
              <Star
                size={26}
                className={clsx(
                  "transition-colors",
                  (hoverRating || rating) >= value
                    ? "fill-amber-400 text-amber-400"
                    : "fill-transparent text-slate-300"
                )}
              />
            </button>
          ))}
        </div>
      </FieldWrapper>

      <FieldWrapper label={t("forms.fields.name")} required>
        <TextInput name="name" required placeholder={t("forms.placeholders.name")} />
      </FieldWrapper>
      <FieldWrapper label={t("forms.fields.company")}>
        <TextInput name="company" placeholder={t("forms.placeholders.company")} />
      </FieldWrapper>
      <FieldWrapper label={t("testimonialForm.message")} required>
        <TextArea
          name="message"
          required
          rows={4}
          placeholder={t("testimonialForm.messagePlaceholder")}
        />
      </FieldWrapper>

      <p className="text-xs text-[var(--color-text-muted)]">{t("testimonialForm.moderationNote")}</p>

      {status === "error" && <ErrorMessage message={t("forms.errors.generic")} />}

      <Button type="submit" size="lg" icon={<Send size={17} />} className="self-start">
        {status === "submitting" ? t("forms.buttons.sending") : t("testimonialForm.submit")}
      </Button>
    </form>
  );
}
