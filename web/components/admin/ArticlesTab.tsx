"use client";

import { useMemo, useState, FormEvent } from "react";
import type { RawArticle } from "@/lib/data";
import type { ArticleStatus } from "@/lib/types";
import { Plus, Trash2, Lock, RefreshCw, EyeOff, Eye, Pencil, X, Search } from "lucide-react";

type RawTranslation = NonNullable<RawArticle["translations"]["fr"]>;

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: "Brouillon (masquée)",
  published: "Publié",
};

/** "Label|/href" par ligne <-> tableau de liens — évite une UI de liste
 *  dynamique complexe pour un besoin simple (maillage interne). */
function linksToText(links?: { href: string; label: string }[]): string {
  return (links ?? []).map((l) => `${l.label}|${l.href}`).join("\n");
}
function textToLinks(text: string): { href: string; label: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, href] = line.split("|").map((s) => s.trim());
      return { label: label || href || "", href: href || "" };
    })
    .filter((l) => l.href);
}

/** "Question|Réponse" par ligne <-> tableau de FAQ. */
function faqToText(faq?: { q: string; a: string }[]): string {
  return (faq ?? []).map((f) => `${f.q}|${f.a}`).join("\n");
}
function textToFaq(text: string): { q: string; a: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [q, a] = line.split("|").map((s) => s.trim());
      return { q: q || "", a: a || "" };
    })
    .filter((f) => f.q && f.a);
}

function TranslationFields({
  locale,
  label,
  defaultValue,
  required,
}: {
  locale: "fr" | "ar" | "en";
  label: string;
  defaultValue?: RawTranslation;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">{label}</p>
      <input
        name={`${locale}_title`}
        required={required}
        defaultValue={defaultValue?.title}
        placeholder="Titre"
        className="admin-input"
      />
      <input
        name={`${locale}_excerpt`}
        required={required}
        defaultValue={defaultValue?.excerpt}
        placeholder="Résumé (meta description)"
        className="admin-input"
      />
      <input
        name={`${locale}_category`}
        required={required}
        defaultValue={defaultValue?.category}
        placeholder="Catégorie (ex: Achat, Technique, Maintenance)"
        className="admin-input"
      />
      <textarea
        name={`${locale}_content`}
        required={required}
        defaultValue={defaultValue?.content?.join("\n")}
        placeholder="Contenu — un paragraphe par ligne"
        rows={5}
        className="admin-input"
      />
      <textarea
        name={`${locale}_relatedLinks`}
        defaultValue={linksToText(defaultValue?.relatedLinks)}
        placeholder={"Liens internes (optionnel) — un par ligne : Libellé|/chemin"}
        rows={2}
        className="admin-input"
      />
      <textarea
        name={`${locale}_faq`}
        defaultValue={faqToText(defaultValue?.faq)}
        placeholder={"FAQ (optionnel) — une par ligne : Question|Réponse"}
        rows={2}
        className="admin-input"
      />
    </div>
  );
}

function readTranslation(formData: FormData, locale: "fr" | "ar" | "en"): RawTranslation | null {
  const title = String(formData.get(`${locale}_title`) || "").trim();
  const excerpt = String(formData.get(`${locale}_excerpt`) || "").trim();
  const category = String(formData.get(`${locale}_category`) || "").trim();
  if (!title || !excerpt || !category) return null;
  return {
    title,
    excerpt,
    category,
    content: String(formData.get(`${locale}_content`) || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
    relatedLinks: textToLinks(String(formData.get(`${locale}_relatedLinks`) || "")),
    faq: textToFaq(String(formData.get(`${locale}_faq`) || "")),
  };
}

export function ArticlesTab({ initialArticles }: { initialArticles: RawArticle[] }) {
  const [articles, setArticles] = useState(initialArticles);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ArticleStatus | "all">("all");

  const editingArticle = editingId ? articles.find((a) => a.id === editingId) ?? null : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((a) => {
      const status = a.status ?? "published";
      if (filterStatus !== "all" && status !== filterStatus) return false;
      if (!q) return true;
      return (a.translations.fr?.title ?? "").toLowerCase().includes(q) || a.slug.includes(q);
    });
  }, [articles, search, filterStatus]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/articles");
      const json = await res.json();
      setArticles(json.articles ?? []);
    } finally {
      setLoading(false);
    }
  }

  function startAdd() {
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(a: RawArticle) {
    setEditingId(a.id);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);

    const fr = readTranslation(formData, "fr");
    if (!fr) {
      setSubmitting(false);
      return;
    }
    const ar = readTranslation(formData, "ar");
    const en = readTranslation(formData, "en");

    const body = {
      readTimeMinutes: Number(formData.get("readTimeMinutes")) || 5,
      status: formData.get("status") as ArticleStatus,
      translations: { fr, ...(ar ? { ar } : {}), ...(en ? { en } : {}) },
    };

    try {
      const res = await fetch(
        editingId ? `/api/admin/articles/${editingId}` : "/api/admin/articles",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (res.ok) {
        cancelForm();
        await refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(id: string, status: ArticleStatus) {
    setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    await fetch(`/api/admin/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function remove(id: string) {
    if (!confirm("Supprimer définitivement cet article ?")) return;
    setArticles((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/admin/articles/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Articles affichés sur <strong>/blog</strong>. Le français est obligatoire ; l&apos;arabe et
          l&apos;anglais sont optionnels — sans traduction, l&apos;article s&apos;affiche en français
          sur ces langues plutôt que de casser la page. Un article <strong>Publié</strong> apparaît
          immédiatement sur le site public avec son schema Article/FAQPage.
        </p>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualiser
          </button>
          <button
            onClick={() => (showForm && !editingId ? cancelForm() : startAdd())}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b58ad]"
          >
            <Plus size={14} /> Ajouter un article
          </button>
        </div>
      </div>

      {showForm && (
        <form
          key={editingId ?? "new"}
          onSubmit={onSubmit}
          className="mb-6 flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-white p-5"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[var(--color-ink)]">
              {editingArticle
                ? `Modifier : ${editingArticle.translations.fr?.title ?? editingArticle.slug}`
                : "Nouvel article"}
            </p>
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              name="readTimeMinutes"
              type="number"
              min={1}
              defaultValue={editingArticle?.readTimeMinutes ?? 5}
              placeholder="Temps de lecture (min)"
              className="admin-input"
            />
            <select
              name="status"
              defaultValue={editingArticle?.status ?? "published"}
              className="admin-input sm:col-span-2"
            >
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <TranslationFields locale="fr" label="Français (obligatoire)" defaultValue={editingArticle?.translations.fr} required />
          <TranslationFields locale="ar" label="العربية (optionnel)" defaultValue={editingArticle?.translations.ar} />
          <TranslationFields locale="en" label="English (optional)" defaultValue={editingArticle?.translations.en} />

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b262f]"
          >
            {submitting
              ? "Enregistrement..."
              : editingArticle
                ? "Enregistrer les modifications"
                : "Ajouter l'article"}
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher : titre, slug..."
            className="admin-input w-full pl-8"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ArticleStatus | "all")}
          className="admin-input"
        >
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--color-text-muted)]">
          {filtered.length} / {articles.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-start text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="px-4 py-3 text-start">Article</th>
              <th className="px-4 py-3 text-start">Langues</th>
              <th className="px-4 py-3 text-start">Statut</th>
              <th className="px-4 py-3 text-start">Source</th>
              <th className="px-4 py-3 text-start"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const status = a.status ?? "published";
              const isDemo = a.isDemo ?? true;
              const langs = (["fr", "ar", "en"] as const).filter((l) => a.translations[l]);
              return (
                <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">
                    {a.translations.fr?.title ?? a.slug}
                    <p className="mt-0.5 text-xs font-normal text-[var(--color-text-muted)]">/blog/{a.slug}</p>
                  </td>
                  <td className="px-4 py-3 uppercase text-xs text-[var(--color-text-muted)]">
                    {langs.join(" · ")}
                  </td>
                  <td className="px-4 py-3">
                    {isDemo ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {STATUS_LABELS[status]}
                      </span>
                    ) : (
                      <select
                        value={status}
                        onChange={(e) => setStatus(a.id, e.target.value as ArticleStatus)}
                        className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-medium"
                      >
                        {Object.entries(STATUS_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isDemo ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <Lock size={11} /> Démo
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600">Réel</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end">
                    {!isDemo && (
                      <div className="flex items-center justify-end gap-1">
                        {status === "published" && (
                          <button
                            onClick={() => setStatus(a.id, "draft")}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                            aria-label="Masquer du site public"
                            title="Masquer du site public"
                          >
                            <EyeOff size={15} />
                          </button>
                        )}
                        {status === "draft" && (
                          <button
                            onClick={() => setStatus(a.id, "published")}
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                            aria-label="Republier"
                            title="Republier sur le site public"
                          >
                            <Eye size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(a)}
                          className="rounded-md p-1.5 text-[var(--color-accent)] hover:bg-blue-50"
                          aria-label="Modifier"
                          title="Modifier"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => remove(a.id)}
                          className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                          aria-label="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  Aucun article ne correspond à la recherche.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
