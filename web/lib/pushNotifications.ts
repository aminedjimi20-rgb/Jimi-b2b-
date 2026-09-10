/**
 * Logique métier des notifications push envoyées aux visiteurs abonnés
 * (distinct des alertes WhatsApp admin dans lib/notifications.ts et
 * lib/adminAlerts.ts, qui ont un public différent). Deux déclencheurs :
 *  - notifyNewProduct : appelé quand une machine/pièce passe en "published".
 *  - sendInactivityReminders : appelé par le cron quotidien (voir
 *    app/api/cron/push-reminders/route.ts) pour les visiteurs inactifs.
 * Anti-spam appliqué aux deux : plafond quotidien par abonné + délai
 * minimum entre deux notifications, quel que soit leur type.
 */
import { getActiveSubscribers, recordNotificationSent, unsubscribe, type PushSubscriber } from "@/lib/pushStore";
import { sendPushToSubscriber, isPushConfigured } from "@/lib/webPush";

const MAX_NOTIFICATIONS_PER_DAY = 2;
const MIN_HOURS_BETWEEN_NOTIFICATIONS = 20;
const REMINDER_INACTIVITY_DAYS = 7;
const REMINDER_COOLDOWN_DAYS = 7;

type Locale = "fr" | "ar" | "en";

const TEXT: Record<Locale, { newProductTitle: string; newProduct: (name: string) => string; reminderTitle: string; reminderBody: string }> = {
  fr: {
    newProductTitle: "🆕 Nouveau chez JIMI",
    newProduct: (name) => `${name} vient d'être ajouté(e) — jetez un œil !`,
    reminderTitle: "JIMI Renovation & Installation",
    reminderBody: "De nouveaux produits vous attendent peut-être — repassez faire un tour !",
  },
  ar: {
    newProductTitle: "🆕 جديد عند JIMI",
    newProduct: (name) => `${name} تزادت للتو — شوفوها!`,
    reminderTitle: "JIMI Renovation & Installation",
    reminderBody: "ربما كاين منتجات جديدة تستناكم — عاودو زورونا!",
  },
  en: {
    newProductTitle: "🆕 New at JIMI",
    newProduct: (name) => `${name} was just added — take a look!`,
    reminderTitle: "JIMI Renovation & Installation",
    reminderBody: "New items may be waiting for you — come take a look!",
  },
};

function textFor(locale: string): (typeof TEXT)["fr"] {
  return TEXT[(locale as Locale) in TEXT ? (locale as Locale) : "fr"];
}

function isEligibleForAnyNotification(subscriber: PushSubscriber, now: Date): boolean {
  if (subscriber.engaged) return false;
  const today = now.toISOString().slice(0, 10);
  const sentToday = subscriber.notifiedCountDate === today ? subscriber.notifiedCountToday : 0;
  if (sentToday >= MAX_NOTIFICATIONS_PER_DAY) return false;
  if (subscriber.lastNotifiedAt) {
    const hoursSince = (now.getTime() - new Date(subscriber.lastNotifiedAt).getTime()) / 3_600_000;
    if (hoursSince < MIN_HOURS_BETWEEN_NOTIFICATIONS) return false;
  }
  return true;
}

async function dispatch(subscriber: PushSubscriber, payload: { title: string; body: string; url: string }) {
  const result = await sendPushToSubscriber(subscriber, payload);
  if (result === "gone") {
    await unsubscribe(subscriber.endpoint);
    return;
  }
  if (result === "sent") {
    await recordNotificationSent(subscriber.id);
  }
}

/** Notifie tous les abonnés éligibles qu'un nouveau produit vient d'être
 *  publié. Best-effort et silencieux si Web Push n'est pas configuré. */
export async function notifyNewProduct(product: { name: string; url: string }): Promise<void> {
  if (!isPushConfigured()) return;

  const now = new Date();
  const subscribers = await getActiveSubscribers();
  const eligible = subscribers.filter((s) => isEligibleForAnyNotification(s, now));

  await Promise.allSettled(
    eligible.map((subscriber) => {
      const text = textFor(subscriber.locale);
      return dispatch(subscriber, {
        title: text.newProductTitle,
        body: text.newProduct(product.name),
        url: product.url,
      });
    })
  );
}

/** Appelé par le cron quotidien : relance les visiteurs inactifs depuis
 *  REMINDER_INACTIVITY_DAYS, sans dépasser les mêmes limites anti-spam. */
export async function sendInactivityReminders(): Promise<{ sent: number; checked: number }> {
  if (!isPushConfigured()) return { sent: 0, checked: 0 };

  const now = new Date();
  const subscribers = await getActiveSubscribers();

  const eligible = subscribers.filter((s) => {
    if (!isEligibleForAnyNotification(s, now)) return false;
    const daysSinceSeen = (now.getTime() - new Date(s.lastSeenAt).getTime()) / 86_400_000;
    if (daysSinceSeen < REMINDER_INACTIVITY_DAYS) return false;
    if (s.lastNotifiedAt) {
      const daysSinceNotified = (now.getTime() - new Date(s.lastNotifiedAt).getTime()) / 86_400_000;
      if (daysSinceNotified < REMINDER_COOLDOWN_DAYS) return false;
    }
    return true;
  });

  const results = await Promise.allSettled(
    eligible.map((subscriber) => {
      const text = textFor(subscriber.locale);
      return dispatch(subscriber, { title: text.reminderTitle, body: text.reminderBody, url: "/" });
    })
  );

  return { sent: results.filter((r) => r.status === "fulfilled").length, checked: subscribers.length };
}
