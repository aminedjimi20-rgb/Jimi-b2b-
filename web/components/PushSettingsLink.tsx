"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { isPushSupported, getExistingPushSubscription, subscribeToPush, unsubscribeFromPush } from "@/lib/pushClient";

export function PushSettingsLink() {
  const t = useTranslations("push");
  const locale = useLocale();
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported()) return;
    // Feature-detection + reading current subscription state on mount — the
    // textbook effect use case, flagged as a false positive by this
    // experimental compiler diagnostic (see ConversationsTab.tsx for the
    // same pattern).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(true);
    void getExistingPushSubscription().then((sub) => setSubscribed(Boolean(sub)));
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        await subscribeToPush(locale);
        setSubscribed(true);
      }
    } catch (err) {
      setError(err instanceof Error && err.message === "permission_denied" ? t("errorPermissionDenied") : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="text-start hover:text-white disabled:opacity-60"
      >
        {subscribed ? t("manageEnabled") : t("manageDisabled")}
      </button>
      {error && <span className="max-w-xs text-xs text-red-400">{error}</span>}
    </span>
  );
}
