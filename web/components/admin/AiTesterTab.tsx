"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import type { Conversation, ConversationMessage, LeadScoreLevel, QualificationData } from "@/lib/types";
import { Bot, Send, RefreshCw, User, Flame, ImagePlus } from "lucide-react";

const SCENARIOS: { label: string; message: string; imageUrl?: string }[] = [
  { label: "1. Cherche une machine", message: "سلام، نحتاج ماكينة تعبئة بلاستيك للانتاج المتوسط" },
  { label: "2. Vendre une machine", message: "Bonjour, je veux vendre ma presse à injection, elle est en bon état" },
  { label: "3. Pièce électronique", message: "Salut, je cherche une carte électronique pour une presse Haitian" },
  { label: "4. Pièce mécanique", message: "نحتاج قطعة ميكانيكية لفيس ديال presse" },
  { label: "5. Pièce hydraulique", message: "Bonjour, il me faut une pompe hydraulique pour ma machine" },
  { label: "6. Cherche un moule", message: "سلام، نحوس على مول تاع بلاستيك" },
  { label: "7. Demande d'intervention", message: "La machine est en panne depuis hier, elle démarre pas" },
  { label: "8. Demande de prix", message: "Salam, chhal prix dyal presse 100 tonnes?" },
  {
    label: "9. Envoie une photo",
    message: "[Photo envoyée]",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  },
  {
    label: "10. Darija avec fautes",
    message: "salem khoya , 3andi presse rah khayba , n7eb ndir 3lik صيانة , win rakom؟",
  },
];

const SCORE_STYLES: Record<LeadScoreLevel, string> = {
  HOT: "bg-red-50 text-red-700 ring-1 ring-red-200",
  WARM: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  COLD: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
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

export function AiTesterTab() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showImageField, setShowImageField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length]);

  async function sendMessage(message: string, withImageUrl?: string) {
    if (!message.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation?.id,
          message,
          imageUrl: withImageUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erreur inconnue.");
        return;
      }
      setConversation(json.conversation as Conversation);
      setInput("");
      setImageUrl("");
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(input, imageUrl || undefined);
  }

  function startScenario(scenario: (typeof SCENARIOS)[number]) {
    setConversation(null);
    setError(null);
    setInput("");
    setImageUrl("");
    // Nouvelle conversation : conversationId sera null au premier envoi.
    void sendMessage(scenario.message, scenario.imageUrl);
  }

  function resetConversation() {
    setConversation(null);
    setInput("");
    setImageUrl("");
    setError(null);
  }

  const qualificationEntries = conversation
    ? (Object.entries(conversation.qualification) as [keyof QualificationData, unknown][]).filter(
        ([, v]) => v !== null && v !== undefined && v !== ""
      )
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5">
        <div className="mb-2 flex items-center gap-2">
          <Bot size={18} className="text-[var(--color-accent)]" />
          <h2 className="text-base font-bold text-[var(--color-ink)]">Testeur de l&apos;assistant IA</h2>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Simulez une conversation client pour vérifier les réponses de l&apos;IA, les informations
          extraites et le score commercial — avant de la connecter à WhatsApp. Rien ici n&apos;est
          envoyé à un vrai client.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.label}
              onClick={() => startScenario(scenario)}
              disabled={loading}
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-accent)] disabled:opacity-50"
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* Transcript */}
        <div className="flex flex-col rounded-xl border border-[var(--color-border)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <span className="text-sm font-semibold text-[var(--color-ink)]">Conversation simulée</span>
            <button
              onClick={resetConversation}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]"
            >
              <RefreshCw size={13} /> Nouvelle conversation
            </button>
          </div>

          <div className="flex h-[420px] flex-col gap-3 overflow-y-auto p-4">
            {!conversation && (
              <p className="m-auto text-sm text-[var(--color-text-muted)]">
                Choisissez un scénario ci-dessus, ou écrivez directement un message ci-dessous.
              </p>
            )}
            {conversation?.messages.map((m: ConversationMessage) => (
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
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-[var(--color-ink)] text-white"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text)]"
                    }`}
                  >
                    {m.content}
                    {m.mediaUrls && m.mediaUrls.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 text-xs opacity-80">
                        <ImagePlus size={12} /> Photo jointe
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && <p className="text-xs text-[var(--color-text-muted)]">L&apos;IA réfléchit…</p>}
            <div ref={transcriptEndRef} />
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t border-[var(--color-border)] p-3">
            {showImageField && (
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="URL publique d'une photo (test vision, optionnel)"
                className="admin-input text-xs"
              />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImageField((v) => !v)}
                className="shrink-0 rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-text-muted)] hover:border-[var(--color-accent)]"
                aria-label="Joindre une photo (test)"
                title="Joindre une photo (test)"
              >
                <ImagePlus size={16} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Écrivez le message du client…"
                className="admin-input flex-1"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#0b58ad] disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
          </form>
        </div>

        {/* Extracted data panel */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              Score du lead
            </p>
            {conversation ? (
              <>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${SCORE_STYLES[conversation.score]}`}
                >
                  <Flame size={14} /> {conversation.score}
                </span>
                {conversation.scoreReasons.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-[var(--color-text-muted)]">
                    {conversation.scoreReasons.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">—</p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              Détection
            </p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--color-text-muted)]">Langue</dt>
                <dd className="font-medium text-[var(--color-ink)]">{conversation?.language ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--color-text-muted)]">Catégorie</dt>
                <dd className="text-end font-medium text-[var(--color-ink)]">{conversation?.category ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--color-text-muted)]">Statut</dt>
                <dd className="font-medium text-[var(--color-ink)]">{conversation?.status ?? "—"}</dd>
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
            <p className="text-sm text-[var(--color-text)]">{conversation?.summary ?? "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
