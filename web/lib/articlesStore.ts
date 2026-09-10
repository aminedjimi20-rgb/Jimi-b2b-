import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type { ArticleStatus } from "@/lib/types";
import { getFirestoreAdmin, isFirebaseConfigured } from "@/lib/firebaseAdmin";

interface ArticleTranslationInput {
  title: string;
  excerpt: string;
  category: string;
  content: string[];
  relatedLinks?: { href: string; label: string }[];
  faq?: { q: string; a: string }[];
}

/** Même forme que les entrées de data/articles.json (translations FR
 *  obligatoire, AR/EN optionnelles — voir lib/data.ts `localizeArticle`,
 *  qui retombe sur le FR si une locale demandée n'a pas de traduction). */
export type AdminArticleInput = {
  readTimeMinutes: number;
  status: ArticleStatus;
  translations: {
    fr: ArticleTranslationInput;
    ar?: ArticleTranslationInput;
    en?: ArticleTranslationInput;
  };
};

/** Document brut tel que stocké (Firestore ou fichier) — même forme que
 *  RawArticle dans lib/data.ts, avec en plus status/isDemo qui n'existent
 *  pas sur les 17 articles historiques du fichier statique. */
export interface RuntimeRawArticle {
  id: string;
  slug: string;
  readTimeMinutes: number;
  publishedAt: string;
  status: ArticleStatus;
  isDemo: false;
  translations: AdminArticleInput["translations"];
}

const COLLECTION = "articles";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string, existingSlugs: string[]): Promise<string> {
  let slug = base;
  let counter = 1;
  while (existingSlugs.includes(slug)) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

function buildArticle(id: string, slug: string, input: AdminArticleInput): RuntimeRawArticle {
  return {
    id,
    slug,
    readTimeMinutes: input.readTimeMinutes,
    publishedAt: new Date().toISOString().slice(0, 10),
    status: input.status,
    isDemo: false,
    translations: input.translations,
  };
}

// ---- Firestore-backed implementation (production) --------------------------

async function dbGetRuntimeArticles(): Promise<RuntimeRawArticle[]> {
  const snap = await getFirestoreAdmin().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as RuntimeRawArticle);
}

async function dbAddRuntimeArticle(input: AdminArticleInput): Promise<RuntimeRawArticle> {
  const db = getFirestoreAdmin();
  const existing = await db.collection(COLLECTION).select("slug").get();
  const baseSlug = slugify(input.translations.fr.title);
  const slug = await uniqueSlug(
    baseSlug,
    existing.docs.map((d) => d.get("slug") as string)
  );

  const ref = db.collection(COLLECTION).doc();
  const article = buildArticle(ref.id, slug, input);
  await ref.set({ ...article, createdAt: new Date().toISOString() });
  return article;
}

async function dbUpdateRuntimeArticle(
  id: string,
  patch: Partial<AdminArticleInput>
): Promise<RuntimeRawArticle | null> {
  const db = getFirestoreAdmin();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  // Firestore .update() replaces the whole `translations` map if given —
  // merge it manually so patching just the FR content doesn't wipe an
  // existing AR/EN translation (matches the file-backend behavior below).
  const current = snap.data() as RuntimeRawArticle;
  const merged = {
    ...patch,
    ...(patch.translations
      ? { translations: { ...current.translations, ...patch.translations } }
      : {}),
  };
  await ref.update({ ...merged, updatedAt: new Date().toISOString() });
  return (await ref.get()).data() as RuntimeRawArticle;
}

async function dbDeleteRuntimeArticle(id: string): Promise<void> {
  await getFirestoreAdmin().collection(COLLECTION).doc(id).delete();
}

// ---- Ephemeral file-based fallback (local dev only — see machinesStore.ts
// for why this is NOT the production persistence: configure Firebase). -------

const DATA_DIR = path.join(os.tmpdir(), "jimi-articles-store");
const FILE = path.join(DATA_DIR, "articles.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

async function fileGetRuntimeArticles(): Promise<RuntimeRawArticle[]> {
  try {
    await ensureStore();
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as RuntimeRawArticle[];
  } catch {
    return [];
  }
}

async function fileSaveRuntimeArticles(articles: RuntimeRawArticle[]) {
  await ensureStore();
  await fs.writeFile(FILE, JSON.stringify(articles, null, 2), "utf-8");
}

async function fileAddRuntimeArticle(input: AdminArticleInput): Promise<RuntimeRawArticle> {
  const articles = await fileGetRuntimeArticles();
  const baseSlug = slugify(input.translations.fr.title);
  const slug = await uniqueSlug(baseSlug, articles.map((a) => a.slug));
  const article = buildArticle(randomUUID(), slug, input);

  articles.unshift(article);
  await fileSaveRuntimeArticles(articles);
  return article;
}

async function fileUpdateRuntimeArticle(
  id: string,
  patch: Partial<AdminArticleInput>
): Promise<RuntimeRawArticle | null> {
  const articles = await fileGetRuntimeArticles();
  const index = articles.findIndex((a) => a.id === id);
  if (index === -1) return null;
  articles[index] = {
    ...articles[index],
    ...patch,
    translations: patch.translations
      ? { ...articles[index].translations, ...patch.translations }
      : articles[index].translations,
  };
  await fileSaveRuntimeArticles(articles);
  return articles[index];
}

async function fileDeleteRuntimeArticle(id: string): Promise<void> {
  const articles = await fileGetRuntimeArticles();
  await fileSaveRuntimeArticles(articles.filter((a) => a.id !== id));
}

// ---- Public API -------------------------------------------------------

export async function getRuntimeArticles(): Promise<RuntimeRawArticle[]> {
  return isFirebaseConfigured() ? dbGetRuntimeArticles() : fileGetRuntimeArticles();
}

export async function addRuntimeArticle(input: AdminArticleInput): Promise<RuntimeRawArticle> {
  return isFirebaseConfigured() ? dbAddRuntimeArticle(input) : fileAddRuntimeArticle(input);
}

export async function updateRuntimeArticle(
  id: string,
  patch: Partial<AdminArticleInput>
): Promise<RuntimeRawArticle | null> {
  return isFirebaseConfigured() ? dbUpdateRuntimeArticle(id, patch) : fileUpdateRuntimeArticle(id, patch);
}

export async function deleteRuntimeArticle(id: string): Promise<void> {
  return isFirebaseConfigured() ? dbDeleteRuntimeArticle(id) : fileDeleteRuntimeArticle(id);
}
