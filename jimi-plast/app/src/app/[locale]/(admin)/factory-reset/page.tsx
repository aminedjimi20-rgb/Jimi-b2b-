'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';

const CONFIRM_PHRASE = 'RESET';

/**
 * Page volontairement absente du menu — remise à zéro complète des données
 * métier (clients, employés, fabricants, produits, bons, achats, retours,
 * transport, dépenses, notes, besoins, demandes, stock, historique...).
 * Ne touche jamais aux rôles/permissions, au compte admin lui-même, ni à la
 * vitrine de marque (logos + badge). Irréversible — accessible uniquement
 * par son URL directe, réservée à l'admin.
 */
export default function FactoryResetPage() {
  const { user, token } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ usersDeleted: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  if (user.role.key !== 'admin') {
    return <p className="p-6 text-sm text-red-600">Réservé à l’administrateur.</p>;
  }

  async function run() {
    setError(null);
    setRunning(true);
    try {
      const res = await api.post<{ ok: boolean; usersDeleted: number }>('/admin/factory-reset', { confirm }, token);
      setResult({ usersDeleted: res.usersDeleted });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setRunning(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="text-lg font-medium text-teal">C’est fait. Le site est vierge.</p>
        <p className="mt-2 text-sm text-muted">
          Clients, employés, fabricants, produits, bons, achats, retours, transport, dépenses, notes, besoins,
          demandes et historique ont été effacés. Seul votre propre compte a été gardé — {result.usersDeleted} autre
          {result.usersDeleted === 1 ? '' : 's'} compte{result.usersDeleted === 1 ? '' : 's'} supprimé
          {result.usersDeleted === 1 ? '' : 's'} (y compris tout autre admin). Les rôles/permissions et les logos
          partenaires sont restés intacts.
        </p>
        <p className="mt-3 text-xs text-muted">
          Si la page « Employés & rôles » montre encore d’anciens comptes, faites un rechargement complet
          (Ctrl/Cmd+Maj+R) — c’est le navigateur qui affiche une vieille liste, pas le serveur.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-bold text-red-600">Remise à zéro complète</h1>
      <p className="mt-2 text-sm text-ink">
        Cette action efface <strong>définitivement</strong> : tous les clients, employés, fabricants, produits,
        catégories, bons de vente, achats, retours, transport, dépenses, notes, besoins, demandes de produit,
        négociations, stock, historique et demandes d’inscription.
      </p>
      <p className="mt-2 text-sm text-ink">
        Restent intacts : uniquement votre propre compte (tout autre compte, admin y compris, est supprimé), les
        rôles/permissions, et les logos partenaires + badge d’expérience.
      </p>
      <p className="mt-2 text-sm font-medium text-red-600">Aucun retour en arrière possible.</p>

      <label className="mt-4 flex flex-col gap-1 text-sm">
        <span className="text-muted">
          Tapez <strong>{CONFIRM_PHRASE}</strong> pour confirmer
        </span>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="rounded border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-red-500"
        />
      </label>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        onClick={run}
        disabled={confirm !== CONFIRM_PHRASE || running}
        className="mt-4 w-full rounded bg-red-600 px-4 py-2 font-medium text-white disabled:opacity-40"
      >
        {running ? 'En cours…' : 'Tout effacer'}
      </button>
    </div>
  );
}
