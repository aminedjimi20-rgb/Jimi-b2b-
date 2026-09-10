"use client";

/** Client-side helpers for the Web Push subscription lifecycle. Kept out of
 *  components so both PushNotificationManager and the lead/interest forms
 *  can share the same logic without duplicating it. */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/** Registers the service worker (no-op if already registered) and returns
 *  the existing push subscription, if any — does NOT prompt for permission
 *  or create a new subscription. */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** Full opt-in flow: register the SW, request permission, create a push
 *  subscription with the VAPID public key, and save it server-side. Throws
 *  if the user denies permission or Web Push isn't supported/configured. */
export async function subscribeToPush(locale: string): Promise<void> {
  if (!isPushSupported()) throw new Error("push_not_supported");

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("push_not_configured");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission_denied");

  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  const json = subscription.toJSON();
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, locale }),
  });
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => {});
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}

/** Called after a lead / machine-interest / sell-equipment form is
 *  submitted successfully — best-effort, never throws, never blocks the
 *  form's own success state. */
export async function markPushEngaged(): Promise<void> {
  try {
    const subscription = await getExistingPushSubscription();
    if (!subscription) return;
    await fetch("/api/push/engage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch {
    // best-effort — a missed "stop notifying me" is not worth failing the form over
  }
}
