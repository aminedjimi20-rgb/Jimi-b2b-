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
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        await subscribeToPush(locale);
        setSubscribed(true);
      }
    } catch {
      // permission denied or unsupported — leave state as-is
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="text-start hover:text-white disabled:opacity-60"
    >
      {subscribed ? t("manageEnabled") : t("manageDisabled")}
    </button>
  );
}
