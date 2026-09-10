"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Bell, X } from "lucide-react";
import { isPushSupported, getExistingPushSubscription, subscribeToPush } from "@/lib/pushClient";

const DISMISS_STORAGE_KEY = "jimi_push_prompt_dismissed_at";
const HEARTBEAT_STORAGE_KEY = "jimi_push_last_heartbeat";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000;
const PROMPT_DELAY_MS = 8000;

async function sendHeartbeat(locale: string) {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return;

  const last = Number(localStorage.getItem(HEARTBEAT_STORAGE_KEY) ?? 0);
  if (Date.now() - last < HEARTBEAT_INTERVAL_MS) return;

  try {
    await fetch("/api/push/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint, locale }),
    });
    localStorage.setItem(HEARTBEAT_STORAGE_KEY, String(Date.now()));
  } catch {
    // best-effort
  }
}

export function PushNotificationManager() {
  const t = useTranslations("push");
  const locale = useLocale();
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported() || typeof Notification === "undefined") return;

    if (Notification.permission === "granted") {
      void sendHeartbeat(locale);
      return;
    }

    if (Notification.permission === "denied") return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_STORAGE_KEY) ?? 0);
    if (Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;

    const timer = setTimeout(() => setShowPrompt(true), PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [locale]);

  function dismiss() {
    localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    setShowPrompt(false);
  }

  async function accept() {
    setBusy(true);
    try {
      await subscribeToPush(locale);
    } catch {
      // permission denied, unsupported, or not configured — nothing more to do
    } finally {
      setBusy(false);
      setShowPrompt(false);
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    }
  }

  if (!showPrompt) return null;

  return (
    <div className="animate-fade-up fixed bottom-5 start-5 z-40 max-w-xs rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-lg">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("decline")}
        className="absolute end-2 top-2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <X size={15} />
      </button>
      <div className="flex items-start gap-2.5 pe-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
          <Bell size={16} />
        </span>
        <div>
          <p className="text-sm font-bold text-[var(--color-ink)]">{t("promptTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{t("promptBody")}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={accept}
          disabled={busy}
          className="flex-1 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b58ad] disabled:opacity-60"
        >
          {t("accept")}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]"
        >
          {t("decline")}
        </button>
      </div>
    </div>
  );
}
