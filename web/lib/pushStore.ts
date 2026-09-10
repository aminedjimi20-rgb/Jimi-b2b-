import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { createHash } from "crypto";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

/** Un abonné Web Push : un navigateur ayant accepté les notifications.
 *  Identifié par le hash de son `endpoint` (stable, sert de doc id) — pas
 *  de compte utilisateur, l'abonnement est entièrement anonyme côté site. */
export interface PushSubscriber {
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  locale: string;
  status: "active" | "unsubscribed";
  /** true dès que ce visiteur a soumis un formulaire (lead, intérêt machine,
   *  proposition de vente) — on arrête alors les notifications automatiques
   *  génériques : il est déjà suivi manuellement par l'admin. */
  engaged: boolean;
  createdAt: string;
  lastSeenAt: string;
  lastNotifiedAt: string | null;
  /** Compteur + date (YYYY-MM-DD) pour le plafond quotidien par abonné. */
  notifiedCountToday: number;
  notifiedCountDate: string | null;
}

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  locale: string;
};

const COLLECTION = "pushSubscribers";

export function subscriberIdFromEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

// ---- Firestore-backed implementation (production) --------------------------

async function dbUpsertSubscriber(input: PushSubscriptionInput): Promise<PushSubscriber> {
  const db = getFirestoreAdmin();
  const id = subscriberIdFromEndpoint(input.endpoint);
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  const now = new Date().toISOString();

  if (snap.exists) {
    const existing = snap.data() as PushSubscriber;
    const updated: PushSubscriber = {
      ...existing,
      keys: input.keys,
      locale: input.locale,
      status: "active",
      lastSeenAt: now,
    };
    await ref.set(updated);
    return updated;
  }

  const subscriber: PushSubscriber = {
    id,
    endpoint: input.endpoint,
    keys: input.keys,
    locale: input.locale,
    status: "active",
    engaged: false,
    createdAt: now,
    lastSeenAt: now,
    lastNotifiedAt: null,
    notifiedCountToday: 0,
    notifiedCountDate: null,
  };
  await ref.set(subscriber);
  return subscriber;
}

async function dbTouchLastSeen(endpoint: string, locale: string): Promise<void> {
  const db = getFirestoreAdmin();
  const id = subscriberIdFromEndpoint(endpoint);
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  await ref.update({ lastSeenAt: new Date().toISOString(), locale });
}

async function dbSetStatus(endpoint: string, status: PushSubscriber["status"]): Promise<void> {
  const db = getFirestoreAdmin();
  const id = subscriberIdFromEndpoint(endpoint);
  await db.collection(COLLECTION).doc(id).set({ status }, { merge: true });
}

async function dbMarkEngaged(endpoint: string): Promise<void> {
  const db = getFirestoreAdmin();
  const id = subscriberIdFromEndpoint(endpoint);
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  await ref.update({ engaged: true });
}

async function dbRecordNotificationSent(id: string): Promise<void> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const existing = snap.data() as PushSubscriber;
  const today = new Date().toISOString().slice(0, 10);
  const sameDay = existing.notifiedCountDate === today;
  await ref.update({
    lastNotifiedAt: new Date().toISOString(),
    notifiedCountDate: today,
    notifiedCountToday: sameDay ? existing.notifiedCountToday + 1 : 1,
  });
}

async function dbGetActiveSubscribers(): Promise<PushSubscriber[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).where("status", "==", "active").get();
  return snap.docs.map((d) => d.data() as PushSubscriber);
}

// ---- Ephemeral file-based fallback (local dev only) -------------------------

const DATA_DIR = path.join(os.tmpdir(), "jimi-push-store");
const FILE = path.join(DATA_DIR, "subscribers.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function fileGetAll(): Promise<PushSubscriber[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as PushSubscriber[];
  } catch {
    return [];
  }
}

async function fileSaveAll(subscribers: PushSubscriber[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(subscribers, null, 2), "utf-8");
}

async function fileUpsertSubscriber(input: PushSubscriptionInput): Promise<PushSubscriber> {
  const subscribers = await fileGetAll();
  const id = subscriberIdFromEndpoint(input.endpoint);
  const now = new Date().toISOString();
  const index = subscribers.findIndex((s) => s.id === id);

  if (index !== -1) {
    subscribers[index] = {
      ...subscribers[index],
      keys: input.keys,
      locale: input.locale,
      status: "active",
      lastSeenAt: now,
    };
    await fileSaveAll(subscribers);
    return subscribers[index];
  }

  const subscriber: PushSubscriber = {
    id,
    endpoint: input.endpoint,
    keys: input.keys,
    locale: input.locale,
    status: "active",
    engaged: false,
    createdAt: now,
    lastSeenAt: now,
    lastNotifiedAt: null,
    notifiedCountToday: 0,
    notifiedCountDate: null,
  };
  subscribers.push(subscriber);
  await fileSaveAll(subscribers);
  return subscriber;
}

async function fileTouchLastSeen(endpoint: string, locale: string): Promise<void> {
  const subscribers = await fileGetAll();
  const id = subscriberIdFromEndpoint(endpoint);
  const index = subscribers.findIndex((s) => s.id === id);
  if (index === -1) return;
  subscribers[index] = { ...subscribers[index], lastSeenAt: new Date().toISOString(), locale };
  await fileSaveAll(subscribers);
}

async function fileSetStatus(endpoint: string, status: PushSubscriber["status"]): Promise<void> {
  const subscribers = await fileGetAll();
  const id = subscriberIdFromEndpoint(endpoint);
  const index = subscribers.findIndex((s) => s.id === id);
  if (index === -1) return;
  subscribers[index] = { ...subscribers[index], status };
  await fileSaveAll(subscribers);
}

async function fileMarkEngaged(endpoint: string): Promise<void> {
  const subscribers = await fileGetAll();
  const id = subscriberIdFromEndpoint(endpoint);
  const index = subscribers.findIndex((s) => s.id === id);
  if (index === -1) return;
  subscribers[index] = { ...subscribers[index], engaged: true };
  await fileSaveAll(subscribers);
}

async function fileRecordNotificationSent(id: string): Promise<void> {
  const subscribers = await fileGetAll();
  const index = subscribers.findIndex((s) => s.id === id);
  if (index === -1) return;
  const existing = subscribers[index];
  const today = new Date().toISOString().slice(0, 10);
  const sameDay = existing.notifiedCountDate === today;
  subscribers[index] = {
    ...existing,
    lastNotifiedAt: new Date().toISOString(),
    notifiedCountDate: today,
    notifiedCountToday: sameDay ? existing.notifiedCountToday + 1 : 1,
  };
  await fileSaveAll(subscribers);
}

async function fileGetActiveSubscribers(): Promise<PushSubscriber[]> {
  const subscribers = await fileGetAll();
  return subscribers.filter((s) => s.status === "active");
}

// ---- Public API -------------------------------------------------------

export async function upsertSubscriber(input: PushSubscriptionInput): Promise<PushSubscriber> {
  return isFirebaseConfigured() ? dbUpsertSubscriber(input) : fileUpsertSubscriber(input);
}

export async function touchLastSeen(endpoint: string, locale: string): Promise<void> {
  return isFirebaseConfigured() ? dbTouchLastSeen(endpoint, locale) : fileTouchLastSeen(endpoint, locale);
}

export async function unsubscribe(endpoint: string): Promise<void> {
  return isFirebaseConfigured() ? dbSetStatus(endpoint, "unsubscribed") : fileSetStatus(endpoint, "unsubscribed");
}

export async function markEngaged(endpoint: string): Promise<void> {
  return isFirebaseConfigured() ? dbMarkEngaged(endpoint) : fileMarkEngaged(endpoint);
}

export async function recordNotificationSent(id: string): Promise<void> {
  return isFirebaseConfigured() ? dbRecordNotificationSent(id) : fileRecordNotificationSent(id);
}

export async function getActiveSubscribers(): Promise<PushSubscriber[]> {
  return isFirebaseConfigured() ? dbGetActiveSubscribers() : fileGetActiveSubscribers();
}
