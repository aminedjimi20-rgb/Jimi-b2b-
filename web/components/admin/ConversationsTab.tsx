"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import type {
  Conversation,
  ConversationMessage,
  ConversationStatus,
  LeadScoreLevel,
  QualificationData,
} from "@/lib/types";
import { Bot, User, Flame, MessageCircle, PhoneOutgoing, Pause, Play, CheckCircle2 } from "lucide-react";

const POLL_INTERVAL_MS = 5000;

const SCORE_STYLES: Record<LeadScoreLevel, string> = {
  HOT: "bg-red-50 text-red-700 ring-1 ring-red-200",
  WARM: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  COLD: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
};

const STATUS_LABELS: Record<ConversationStatus, string> = {
  AI_ACTIVE: "IA active",
  HUMAN_REQUIRED: "Humain requis",
  HUMAN_ACTIVE: "Prise en main",
  CLOSED: "Traité",
};

const STATUS_STYLES: Record<ConversationStatus, string> = {
  AI_ACTIVE: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  HUMAN_REQUIRED: "bg-red-50 text-red-700 ring-1 ring-red-200",
  HUMAN_ACTIVE: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  CLOSED: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

const QUALIFICATION_LABELS: Record<keyof QualificationData, string> = {
  machineType: "Type de machine",
  productToManufacture: "Produit à fabriquer",
  desiredCapacity: "Capacité souhaitée",
  budget: "Budget",
  condition: "Neuf / occasion",
  partReference: "Référence pièce",
  partBrand: "Marque",
  machineModel: "Modèle machine",
  quantity: "Quantité",
  issueDescription: "Panne / problème",
  location: "Localisation",
  timeline: "Délai",
  phone: "Téléphone",
  urgent: "Urgent",
  photosReceived: "Photo reçue",
  quoteRequested: "Devis demandé",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export function ConversationsTab() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  async function fetchConversations(silent = false) {
    try {
      const res = await fetch("/api/admin/conversations");
      const json = await res.json();
      if (res.ok) {
        setConversations(json.conversations as Conversation[]);
        setError(null);
      } else if (!silent) {
        setError(json.error || "Erreur inconnue.");
      }
    } catch {
      if (!silent) setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Data fetching on mount + polling refresh — the textbook effect use case
    // (https://react.dev/learn/you-might-not-need-an-effect#fetching-data),
    // flagged as a false positive by this experimental compiler diagnostic
    // because it traces setState calls through the awaited helper.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConversations();
    const interval = setInterval(() => void fetchConversations(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? conversations : conversations.filter((c) => c.status === statusFilter)),
    [conversations, statusFilter]
  );

  async function changeStatus(status: ConversationStatus) {
    if (!selected || actionPending) return;
    setActionPending(true);
    try {
      const res = await fetch(`/api/admin/conversations/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (res.ok) {
        setConversations((prev) => prev.map((c) => (c.id === selected.id ? (json.conversation as Conversation) : c)));
      }
    } finally {
      setActionPending(false);
    }
  }

  async function sendReply(e: FormEvent) {
    e.preventDefault();
    if (!selected || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/admin/conversations/${selected.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setConversations((prev) => prev.map((c) => (c.id === selected.id ? (json.conversation as Conversation) : c)));
        setReplyText("");
      } else {
        setError(json.error === "send_failed" ? "Échec de l'envoi WhatsApp." : json.error || "Erreur inconnue.");
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setSendingReply(false);
    }
  }

  const qualificationEntries = selected
    ? (Object.entries(selected.qualification) as [keyof QualificationData, unknown][]).filter(
        ([, v]) => v !== null && v !== undefined && v !== "" && v !== false && v !== "non precise"
      )
    : [];

  const filterCounts = useMemo(() => {
    const counts: Record<ConversationStatus, number> = {
      AI_ACTIVE: 0,
      HUMAN_REQUIRED: 0,
      HUMAN_ACTIVE: 0,
      CLOSED: 0,
    };
    for (const c of conversations) counts[c.status]++;
    return counts;
  }, [conversations]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5">
        <div className="mb-1 flex items-center gap-2">
          <MessageCircle size={18} className="text-[var(--color-accent)]" />
          <h2 className="text-base font-bold text-[var(--color-ink)]">Conversations WhatsApp</h2>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Suivi en temps réel des conversations réelles avec les clients. L&apos;IA continue de
          répondre automatiquement même si vous n&apos;êtes pas sur cette page.
        </p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Liste des conversations */}
        <div className="flex flex-col rounded-xl border border-[var(--color-border)] bg-white">
          <div className="flex flex-wrap gap-1.5 border-b border-[var(--color-border)] p-3">
            {(["all", "HUMAN_REQUIRED", "AI_ACTIVE", "HUMAN_ACTIVE", "CLOSED"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                  statusFilter === key
                    ? "bg-[var(--color-ink)] text-white"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text)] hover:bg-slate-200"
                }`}
              >
                {key === "all" ? "Toutes" : STATUS_LABELS[key]}
                {key !== "all" && filterCounts[key] > 0 && ` (${filterCounts[key]})`}
              </button>
            ))}
          </div>

          <div className="flex max-h-[640px] flex-col overflow-y-auto">
            {loading && <p className="p-4 text-sm text-[var(--color-text-muted)]">Chargement…</p>}
            {!loading && filtered.length === 0 && (
              <p className="p-4 text-sm text-[var(--color-text-muted)]">Aucune conversation pour le moment.</p>
            )}
            {filtered.map((c) => {
              const lastMessage = c.messages[c.messages.length - 1];
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex flex-col gap-1 border-b border-[var(--color-border)] p-3.5 text-left transition-colors last:border-b-0 ${
                    selectedId === c.id ? "bg-[var(--color-surface-2)]" : "hover:bg-[var(--color-surface-2)]/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--color-ink)]">
                      {c.customerName || c.customerPhone || "Test"}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">{timeAgo(c.updatedAt)}</span>
                  </div>
                  {lastMessage && (
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {lastMessage.role === "assistant" ? "IA : " : ""}
                      {lastMessage.content}
                    </p>
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SCORE_STYLES[c.score]}`}>
                      {c.score}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                    {c.category && (
                      <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                        {c.category}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Détail de la conversation */}
        {selected ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
            <div className="flex flex-col rounded-xl border border-[var(--color-border)] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-[var(--color-ink)]">
                    {selected.customerName || selected.customerPhone || "Conversation test"}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {selected.customerPhone} · {formatDateTime(selected.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.status !== "HUMAN_ACTIVE" && selected.status !== "CLOSED" && (
                    <button
                      onClick={() => changeStatus("HUMAN_ACTIVE")}
                      disabled={actionPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)] disabled:opacity-50"
                    >
                      <Pause size={13} /> Prendre la main
                    </button>
                  )}
                  {selected.status === "HUMAN_ACTIVE" && (
                    <button
                      onClick={() => changeStatus("AI_ACTIVE")}
                      disabled={actionPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)] disabled:opacity-50"
                    >
                      <Play size={13} /> Réactiver l&apos;IA
                    </button>
                  )}
                  {selected.status === "CLOSED" && (
                    <button
                      onClick={() => changeStatus("AI_ACTIVE")}
                      disabled={actionPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)] disabled:opacity-50"
                    >
                      <Play size={13} /> Rouvrir
                    </button>
                  )}
                  {selected.status !== "CLOSED" && (
                    <button
                      onClick={() => changeStatus("CLOSED")}
                      disabled={actionPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/80 disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} /> Marquer traité
                    </button>
                  )}
                </div>
              </div>

              <div className="flex h-[440px] flex-col gap-3 overflow-y-auto p-4">
                {selected.messages.map((m: ConversationMessage) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`flex max-w-[80%] items-start gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          m.role === "user" ? "bg-[var(--color-ink)] text-white" : "bg-[var(--color-accent)] text-white"
                        }`}
                      >
                        {m.role === "user" ? <User size={14} /> : <Bot size={14} />}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div
                          className={`rounded-2xl px-3.5 py-2 text-sm ${
                            m.role === "user"
                              ? "bg-[var(--color-ink)] text-white"
                              : "bg-[var(--color-surface-2)] text-[var(--color-text)]"
                          }`}
                        >
                          {m.content}
                        </div>
                        <span
                          className={`text-[10px] text-[var(--color-text-muted)] ${
                            m.role === "user" ? "text-end" : ""
                          }`}
                        >
                          {formatDateTime(m.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>

              {selected.status === "HUMAN_ACTIVE" && (
                <form onSubmit={sendReply} className="flex items-center gap-2 border-t border-[var(--color-border)] p-3">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Répondre au client sur WhatsApp…"
                    className="admin-input flex-1"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyText.trim()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#0b58ad] disabled:opacity-50"
                  >
                    <PhoneOutgoing size={14} />
                  </button>
                </form>
              )}
            </div>

            {/* Panneau infos */}
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Score du lead
                </p>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${SCORE_STYLES[selected.score]}`}
                >
                  <Flame size={14} /> {selected.score}
                </span>
                {selected.scoreReasons.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-[var(--color-text-muted)]">
                    {selected.scoreReasons.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Détection
                </p>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--color-text-muted)]">Langue</dt>
                    <dd className="font-medium text-[var(--color-ink)]">{selected.language ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--color-text-muted)]">Catégorie</dt>
                    <dd className="text-end font-medium text-[var(--color-ink)]">{selected.category ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--color-text-muted)]">Statut</dt>
                    <dd className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[selected.status]}`}>
                      {STATUS_LABELS[selected.status]}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Données extraites
                </p>
                {qualificationEntries.length > 0 ? (
                  <dl className="space-y-1.5 text-sm">
                    {qualificationEntries.map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-2">
                        <dt className="text-[var(--color-text-muted)]">{QUALIFICATION_LABELS[key]}</dt>
                        <dd className="text-end font-medium text-[var(--color-ink)]">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-[var(--color-text-muted)]">—</p>
                )}
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Résumé</p>
                <p className="text-sm text-[var(--color-text)]">{selected.summary ?? "—"}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-white p-12 text-sm text-[var(--color-text-muted)]">
            Sélectionnez une conversation pour voir le détail.
          </div>
        )}
      </div>
    </div>
  );
}
