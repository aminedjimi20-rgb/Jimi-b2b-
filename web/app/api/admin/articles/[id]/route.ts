import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { updateRuntimeArticle, deleteRuntimeArticle, type AdminArticleInput } from "@/lib/articlesStore";
import { sanitizeStringList } from "@/lib/sanitize";
import type { ArticleStatus } from "@/lib/types";

const VALID_STATUSES: ArticleStatus[] = ["draft", "published"];

function sanitizeTranslation(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (!t.title || !t.excerpt || !t.category) return null;
  return {
    title: String(t.title).slice(0, 200),
    excerpt: String(t.excerpt).slice(0, 300),
    category: String(t.category).slice(0, 100),
    content: sanitizeStringList(t.content, 40, 2000),
    relatedLinks: Array.isArray(t.relatedLinks)
      ? t.relatedLinks
          .filter(
            (l): l is { href: string; label: string } =>
              Boolean(l) && typeof l === "object" && typeof (l as { href?: unknown }).href === "string"
          )
          .map((l) => ({ href: String(l.href).slice(0, 200), label: String(l.label).slice(0, 100) }))
          .slice(0, 8)
      : [],
    faq: Array.isArray(t.faq)
      ? t.faq
          .filter(
            (f): f is { q: string; a: string } =>
              Boolean(f) && typeof f === "object" && typeof (f as { q?: unknown }).q === "string"
          )
          .map((f) => ({ q: String(f.q).slice(0, 200), a: String(f.a).slice(0, 500) }))
          .slice(0, 8)
      : [],
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Partial<AdminArticleInput> & {
    translations?: { fr?: unknown; ar?: unknown; en?: unknown };
  } | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const patch: Partial<AdminArticleInput> = {};
  if ("readTimeMinutes" in body) patch.readTimeMinutes = Number(body.readTimeMinutes) || 5;
  if ("status" in body) {
    if (!VALID_STATUSES.includes(body.status as ArticleStatus)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    patch.status = body.status as ArticleStatus;
  }
  if (body.translations) {
    // Ne construit que les clés (fr/ar/en) réellement fournies et valides —
    // articlesStore fusionne ce patch avec les traductions existantes, donc
    // une clé absente ici laisse la traduction existante de cette langue
    // intacte (ne jamais y mettre `undefined` explicitement, ça l'effacerait).
    const translations: Partial<AdminArticleInput["translations"]> = {};
    for (const loc of ["fr", "ar", "en"] as const) {
      const clean = sanitizeTranslation(body.translations[loc]);
      if (clean) translations[loc] = clean;
    }
    if (Object.keys(translations).length > 0) {
      patch.translations = translations as AdminArticleInput["translations"];
    }
  }

  const article = await updateRuntimeArticle(id, patch);
  if (!article) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, article });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  await deleteRuntimeArticle(id);
  return NextResponse.json({ ok: true });
}
