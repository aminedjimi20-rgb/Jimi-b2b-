# Jimi Renovation & Installation — Site web

Site vitrine / plateforme B2B pour **Jimi Renovation & Installation** :
rénovation et automatisation de machines d'injection plastique, maintenance,
et intermédiation achat/vente de machines industrielles en Algérie.

Stack : **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + next-intl**
(FR par défaut, AR avec RTL, EN).

## Démarrage rapide

```bash
npm install
cp .env.example .env.local   # puis renseignez vos vraies coordonnées
npm run dev                  # http://localhost:3000
```

Build de production :

```bash
npm run build
npm run start
```

## Configuration — une seule source de vérité

Toutes les informations de contact (WhatsApp, téléphone, email, URL du site)
sont centralisées dans **`config/site.config.ts`**, avec les vraies
coordonnées de Jimi Renovation & Installation déjà en valeur par défaut —
aucune configuration n'est requise pour que le site fonctionne. Ces valeurs
restent surchargeables via des variables d'environnement (`.env.local`, voir
`.env.example`) si elles doivent changer, sans toucher au code. Modifiez-les
à un seul endroit : elles se propagent automatiquement partout sur le site
(navbar, footer, boutons WhatsApp dynamiques, JSON-LD, sitemap...).

**Coordonnées actuelles (modifiables via variables d'environnement) :**

| Variable                          | Valeur actuelle          | Utilisation                                    |
| ---------------------------------- | ------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`      | +213 654 486 224          | Numéro WhatsApp principal (tous les boutons)     |
| `NEXT_PUBLIC_PHONE_DISPLAY` / `_HREF` | +213 654 486 224       | Téléphone principal affiché / lien `tel:`        |
| `NEXT_PUBLIC_WHATSAPP_NUMBER_2`, `NEXT_PUBLIC_PHONE_DISPLAY_2` / `_HREF_2` | +213 777 168 962 | Second numéro (footer + page Contact) |
| `NEXT_PUBLIC_EMAIL`                | aminedjimi20@gmail.com    | Email de contact                                 |
| `NEXT_PUBLIC_SITE_URL`             | —                         | URL publique (SEO, sitemap, Open Graph) — à définir selon le domaine final |
| `ADMIN_PASSWORD`                   | —                         | Mot de passe du tableau de bord `/admin` — **à définir avant mise en production** |
| `ADMIN_SESSION_SECRET`             | —                         | Clé secrète de session admin (chaîne aléatoire)  |

## Structure

```
app/[locale]/        Pages publiques (fr sans préfixe, /ar, /en)
app/admin/            Tableau de bord interne (non traduit, protégé par mot de passe)
app/api/              Route handlers (leads, admin)
components/           Composants UI, sections de page, formulaires
config/site.config.ts Configuration centrale (coordonnées, SEO)
data/                 Données de démonstration (machines, réalisations, articles)
lib/                  Accès aux données, i18n helpers, stockage fichier (leads/machines admin)
messages/             Traductions fr.json / ar.json / en.json
```

## Machines et réalisations : aucune donnée fictive

- `data/machines.json` et `data/projects.json` sont **vides par défaut** —
  aucune machine ni réalisation inventée n'est publiée sur le site. Tant
  qu'ils sont vides, les pages `/machines`, `/realisations` et la page
  d'accueil affichent un état vide honnête (« Aucune machine disponible
  actuellement », etc.) avec un appel à l'action vers WhatsApp/contact.
- Les machines ajoutées depuis `/admin` (onglet **Machines**) sont stockées
  dans un dossier temporaire du serveur (`os.tmpdir()` — voir
  `lib/machinesStore.ts`) et apparaissent immédiatement sur le site public.
  ⚠️ Ce stockage est **éphémère** sur les plateformes serverless (Vercel) :
  il peut être réinitialisé à chaque nouveau déploiement ou redémarrage.
  Pour une utilisation réelle en production, remplacez-le par une vraie
  base de données (voir ci-dessous) avant d'ajouter des machines qui
  doivent persister durablement.
- Pour ajouter de vraies réalisations, éditez directement
  `data/projects.json` (structure prête, voir `lib/types.ts`) — il n'y a
  pas encore d'interface admin dédiée pour celles-ci.
- Chaque machine peut avoir sa propre vidéo (section « Voir la machine en
  fonctionnement » sur sa page, badge « Vidéo disponible » sur sa carte).
  Depuis `/admin` (ajout ou icône crayon sur une machine existante),
  renseignez un lien MP4, YouTube ou Vimeo — la lecture s'adapte
  automatiquement (`lib/video.ts`). Aucun upload de fichier n'est câblé
  pour l'instant (seul un lien vidéo est demandé) ; le champ `videoUrl` de
  `Machine` est prêt pour brancher un vrai stockage de fichiers plus tard.
- Pour une mise en production sérieuse avec plusieurs administrateurs ou un
  fort volume de machines/leads, remplacez le stockage fichier
  (`lib/leads.ts`, `lib/machinesStore.ts`) par une vraie base de données
  (Postgres, Supabase, etc.) — l'architecture (types, API routes) est déjà
  prête pour cette migration.

## Tableau de bord admin

Accessible sur `/admin` (mot de passe défini par `ADMIN_PASSWORD`, valeur par
défaut `jimi-admin-2026` si non configuré — **à changer avant mise en
production**). Permet de :

- consulter et traiter les demandes reçues (achat, vente, service, contact) ;
- ajouter / modifier le statut / supprimer des machines réelles ;
- consulter les informations de configuration de l'entreprise.

## SEO

Métadonnées par page, données structurées JSON-LD (Organization, Product,
Article), `sitemap.xml` et `robots.txt` générés automatiquement
(`app/sitemap.ts`, `app/robots.ts`).
