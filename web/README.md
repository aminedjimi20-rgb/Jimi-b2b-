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
sont centralisées dans **`config/site.config.ts`**, surchageables via des
variables d'environnement (`.env.local`, voir `.env.example`). Modifiez-les à
un seul endroit : elles se propagent automatiquement partout sur le site
(navbar, footer, boutons WhatsApp dynamiques, JSON-LD, sitemap...).

**Placeholders à remplacer avant la mise en ligne réelle :**

| Variable                      | Utilisation                                  |
| ------------------------------ | --------------------------------------------- |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`  | Numéro WhatsApp (format international)        |
| `NEXT_PUBLIC_PHONE_DISPLAY`    | Téléphone affiché                             |
| `NEXT_PUBLIC_PHONE_HREF`       | Téléphone pour les liens `tel:`               |
| `NEXT_PUBLIC_EMAIL`            | Email de contact                              |
| `NEXT_PUBLIC_SITE_URL`         | URL publique (SEO, sitemap, Open Graph)        |
| `ADMIN_PASSWORD`               | Mot de passe du tableau de bord `/admin`      |
| `ADMIN_SESSION_SECRET`         | Clé secrète de session admin (chaîne aléatoire)|

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

## Machines : démo vs réel

- `data/machines.json` contient des **fiches de démonstration** (clairement
  indiquées comme telles sur le site) pour illustrer le fonctionnement de la
  plateforme.
- Les machines ajoutées depuis `/admin` (onglet **Machines**) sont stockées
  dans `.data/machines.json` (créé automatiquement, non versionné) et
  apparaissent immédiatement sur le site public, sans le badge « Démo ».
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
