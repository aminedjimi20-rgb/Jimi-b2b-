"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { isPushSupported, getExistingPushSubscription, subscribeToPush } from "@/lib/pushClient";

const HEARTBEAT_STORAGE_KEY = "jimi_push_last_heartbeat";
const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000;

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

/** No custom opt-in banner: as soon as a visitor lands on the site, this
 *  triggers the browser's own native permission prompt directly — the one
 *  dialog every browser shows for Notification.requestPermission() and
 *  that no website can skip or replace. If they already answered
 *  (granted/denied), nothing is shown again; a granted subscriber's "last
 *  seen" is refreshed via a throttled heartbeat instead. */
export function PushNotificationManager() {
  const locale = useLocale();

  useEffect(() => {
    if (!isPushSupported() || typeof Notification === "undefined") return;

    if (Notification.permission === "granted") {
      void sendHeartbeat(locale);
      return;
    }

    if (Notification.permission === "denied") return;

    subscribeToPush(locale).catch(() => {
      // permission denied, unsupported, or Web Push not configured — nothing to do
    });
  }, [locale]);

  return null;
}
