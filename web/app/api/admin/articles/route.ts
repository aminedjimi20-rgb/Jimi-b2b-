import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getAllArticlesRaw } from "@/lib/data";
import { addRuntimeArticle, type AdminArticleInput } from "@/lib/articlesStore";
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

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const articles = await getAllArticlesRaw();
  return NextResponse.json({ articles });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    readTimeMinutes?: number;
    status?: ArticleStatus;
    translations?: { fr?: unknown; ar?: unknown; en?: unknown };
  } | null;

  const fr = sanitizeTranslation(body?.translations?.fr);
  if (!fr) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const ar = sanitizeTranslation(body?.translations?.ar);
  const en = sanitizeTranslation(body?.translations?.en);

  const input: AdminArticleInput = {
    readTimeMinutes: Number(body?.readTimeMinutes) || 5,
    status: VALID_STATUSES.includes(body?.status as ArticleStatus)
      ? (body!.status as ArticleStatus)
      : "published",
    translations: {
      fr,
      ...(ar ? { ar } : {}),
      ...(en ? { en } : {}),
    },
  };

  const article = await addRuntimeArticle(input);
  return NextResponse.json({ ok: true, article });
}
