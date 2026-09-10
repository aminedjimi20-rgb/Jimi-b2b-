"use client";

import { useState, FormEvent } from "react";
import { markPushEngaged } from "@/lib/pushClient";

type Status = "idle" | "submitting" | "success" | "error";

export function useListingSubmission() {
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const website = String(formData.get("website") ?? "");
    formData.delete("website");

    const photosRaw = String(formData.get("photos") ?? "[]");
    let photos: string[] = [];
    try {
      const parsed = JSON.parse(photosRaw);
      if (Array.isArray(parsed)) photos = parsed.filter((p): p is string => typeof p === "string");
    } catch {
      photos = [];
    }
    formData.delete("photos");

    const payload: Record<string, unknown> = { website, photos };
    formData.forEach((value, key) => {
      if (typeof value === "string" && value.trim() !== "") {
        payload[key] = value;
      }
    });
    payload.priceOnRequest = formData.get("priceOnRequest") === "on";

    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("request_failed");
      setStatus("success");
      form.reset();
      void markPushEngaged();
    } catch {
      setStatus("error");
    }
  }

  return { status, submit };
}
