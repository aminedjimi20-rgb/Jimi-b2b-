import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type { Conversation, ConversationChannel, ConversationMessage } from "@/lib/types";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

const COLLECTION = "conversations";

function newConversation(channel: ConversationChannel, customerPhone: string | null): Conversation {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    channel,
    customerPhone,
    customerName: null,
    status: "AI_ACTIVE",
    language: null,
    category: null,
    score: "COLD",
    scoreReasons: [],
    qualification: {},
    summary: null,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ---- Firestore-backed implementation (production) --------------------------

async function dbGetConversations(): Promise<Conversation[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).orderBy("updatedAt", "desc").get();
  return snap.docs.map((d) => d.data() as Conversation);
}

async function dbGetConversationById(id: string): Promise<Conversation | null> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).doc(id).get();
  return snap.exists ? (snap.data() as Conversation) : null;
}

async function dbGetConversationByPhone(phone: string): Promise<Conversation | null> {
  // Single-field equality query — no composite index required. The
  // "CLOSED" filter is applied in memory since a customer rarely has more
  // than a handful of conversations.
  const snap = await getFirestoreAdmin().collection(COLLECTION).where("customerPhone", "==", phone).get();
  const open = snap.docs.map((d) => d.data() as Conversation).find((c) => c.status !== "CLOSED");
  return open ?? null;
}

async function dbSaveConversation(conversation: Conversation): Promise<void> {
  await getFirestoreAdmin().collection(COLLECTION).doc(conversation.id).set(conversation);
}

async function dbDeleteConversation(id: string): Promise<void> {
  await getFirestoreAdmin().collection(COLLECTION).doc(id).delete();
}

// ---- Ephemeral file-based fallback (local dev only — see machinesStore.ts
// for why this is not the production fix) -----------------------------

const DATA_DIR = path.join(os.tmpdir(), "jimi-conversations-store");
const FILE = path.join(DATA_DIR, "conversations.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function fileGetAll(): Promise<Conversation[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

async function fileSaveAll(conversations: Conversation[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(conversations, null, 2), "utf-8");
}

async function fileGetConversations(): Promise<Conversation[]> {
  const all = await fileGetAll();
  return [...all].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

async function fileGetConversationById(id: string): Promise<Conversation | null> {
  const all = await fileGetAll();
  return all.find((c) => c.id === id) ?? null;
}

async function fileGetConversationByPhone(phone: string): Promise<Conversation | null> {
  const all = await fileGetAll();
  return all.find((c) => c.customerPhone === phone && c.status !== "CLOSED") ?? null;
}

async function fileSaveConversation(conversation: Conversation): Promise<void> {
  const all = await fileGetAll();
  const index = all.findIndex((c) => c.id === conversation.id);
  if (index === -1) all.unshift(conversation);
  else all[index] = conversation;
  await fileSaveAll(all);
}

async function fileDeleteConversation(id: string): Promise<void> {
  const all = await fileGetAll();
  await fileSaveAll(all.filter((c) => c.id !== id));
}

// ---- Public API -------------------------------------------------------

export async function getConversations(): Promise<Conversation[]> {
  return isFirebaseConfigured() ? dbGetConversations() : fileGetConversations();
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  return isFirebaseConfigured() ? dbGetConversationById(id) : fileGetConversationById(id);
}

/** Récupère la conversation ouverte (non "CLOSED") pour un numéro WhatsApp,
 *  ou en crée une nouvelle si aucune n'existe. */
export async function getOrCreateConversationByPhone(
  phone: string,
  customerName: string | null = null
): Promise<Conversation> {
  const existing = isFirebaseConfigured()
    ? await dbGetConversationByPhone(phone)
    : await fileGetConversationByPhone(phone);
  if (existing) return existing;
  const conversation = newConversation("whatsapp", phone);
  conversation.customerName = customerName;
  await saveConversation(conversation);
  return conversation;
}

export async function createTestConversation(): Promise<Conversation> {
  const conversation = newConversation("test", null);
  await saveConversation(conversation);
  return conversation;
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  conversation.updatedAt = new Date().toISOString();
  return isFirebaseConfigured() ? dbSaveConversation(conversation) : fileSaveConversation(conversation);
}

export async function appendMessage(
  conversationId: string,
  message: Omit<ConversationMessage, "id" | "createdAt">
): Promise<Conversation | null> {
  const conversation = await getConversationById(conversationId);
  if (!conversation) return null;
  conversation.messages.push({
    ...message,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  });
  await saveConversation(conversation);
  return conversation;
}

export async function updateConversation(
  id: string,
  patch: Partial<Omit<Conversation, "id" | "messages">>
): Promise<Conversation | null> {
  const conversation = await getConversationById(id);
  if (!conversation) return null;
  Object.assign(conversation, patch);
  await saveConversation(conversation);
  return conversation;
}

export async function deleteConversation(id: string): Promise<void> {
  return isFirebaseConfigured() ? dbDeleteConversation(id) : fileDeleteConversation(id);
}
