import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

/** Carnet d'adresses privé de l'admin — clients, prospects ou tout contact
 *  à garder de côté pour les recontacter plus tard. Jamais exposé
 *  publiquement, jamais lié aux vendeurs/acheteurs des flux publics
 *  (SellerProfile/BuyerProfile) : c'est un espace de notes libres, pas un
 *  registre transactionnel. */
export type ContactNoteType = "client" | "prospect" | "autre";

export interface ContactNote {
  id: string;
  name: string;
  phone?: string;
  type: ContactNoteType;
  wilaya?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type ContactNoteInput = {
  name: string;
  phone?: string;
  type: ContactNoteType;
  wilaya?: string;
  notes: string;
};

const COLLECTION = "contactNotes";

function buildNote(id: string, input: ContactNoteInput, now: string): ContactNote {
  return {
    id,
    name: input.name,
    phone: input.phone || undefined,
    type: input.type,
    wilaya: input.wilaya || undefined,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
}

// ---- Firestore-backed implementation (production) --------------------------

async function dbGetContactNotes(): Promise<ContactNote[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as ContactNote);
}

async function dbAddContactNote(input: ContactNoteInput): Promise<ContactNote> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc();
  const now = new Date().toISOString();
  const note = buildNote(ref.id, input, now);
  await ref.set(note);
  return note;
}

async function dbUpdateContactNote(id: string, patch: Partial<ContactNoteInput>): Promise<ContactNote | null> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ ...patch, updatedAt: new Date().toISOString() });
  return (await ref.get()).data() as ContactNote;
}

async function dbDeleteContactNote(id: string): Promise<void> {
  await getFirestoreAdmin().collection(COLLECTION).doc(id).delete();
}

// ---- Ephemeral file-based fallback (local dev only — see machinesStore.ts
// for why this is NOT the production persistence: configure Firebase). -------

const DATA_DIR = path.join(os.tmpdir(), "jimi-contact-notes-store");
const FILE = path.join(DATA_DIR, "contact-notes.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function fileGetContactNotes(): Promise<ContactNote[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as ContactNote[];
  } catch {
    return [];
  }
}

async function fileSaveContactNotes(notes: ContactNote[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(notes, null, 2), "utf-8");
}

async function fileAddContactNote(input: ContactNoteInput): Promise<ContactNote> {
  const notes = await fileGetContactNotes();
  const now = new Date().toISOString();
  const note = buildNote(randomUUID(), input, now);
  notes.unshift(note);
  await fileSaveContactNotes(notes);
  return note;
}

async function fileUpdateContactNote(id: string, patch: Partial<ContactNoteInput>): Promise<ContactNote | null> {
  const notes = await fileGetContactNotes();
  const index = notes.findIndex((n) => n.id === id);
  if (index === -1) return null;
  notes[index] = { ...notes[index], ...patch, updatedAt: new Date().toISOString() };
  await fileSaveContactNotes(notes);
  return notes[index];
}

async function fileDeleteContactNote(id: string): Promise<void> {
  const notes = await fileGetContactNotes();
  await fileSaveContactNotes(notes.filter((n) => n.id !== id));
}

// ---- Public API -------------------------------------------------------

export async function getContactNotes(): Promise<ContactNote[]> {
  return isFirebaseConfigured() ? dbGetContactNotes() : fileGetContactNotes();
}

export async function addContactNote(input: ContactNoteInput): Promise<ContactNote> {
  return isFirebaseConfigured() ? dbAddContactNote(input) : fileAddContactNote(input);
}

export async function updateContactNote(id: string, patch: Partial<ContactNoteInput>): Promise<ContactNote | null> {
  return isFirebaseConfigured() ? dbUpdateContactNote(id, patch) : fileUpdateContactNote(id, patch);
}

export async function deleteContactNote(id: string): Promise<void> {
  return isFirebaseConfigured() ? dbDeleteContactNote(id) : fileDeleteContactNote(id);
}
