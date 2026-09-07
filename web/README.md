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

## Base de données et stockage — configuration obligatoire en production

⚠️ **Sans cette étape, les machines/leads/vendeurs/acheteurs peuvent
disparaître après une action admin (Approve, etc.).** C'est exactement le
bug qui se produisait auparavant : Vercel exécute chaque requête sur une
instance serverless parmi plusieurs, et un fichier écrit dans le dossier
temporaire d'une instance (`os.tmpdir()`) n'est pas visible par les autres
instances ni garanti de survivre — la requête suivante peut retomber sur
une instance « vide ». Le stockage fichier reste utilisé automatiquement en
développement local (pratique, zéro configuration), mais **n'est pas une
persistance réelle** : c'est pour ça qu'une machine approuvée pouvait
sembler avoir disparu.

La vraie base de données est **Firebase Firestore**, déjà câblée dans le
code (`lib/firebaseAdmin.ts`, `lib/sellers.ts`, `lib/buyers.ts`,
`lib/machinesStore.ts`, `lib/machineLeads.ts`, `lib/leads.ts` basculent
automatiquement sur Firestore dès que les variables d'environnement sont
présentes). Les photos/vidéos sont hébergées sur **Cloudinary** plutôt que
Firebase Storage — Firebase Storage exige le plan payant Blaze (carte
bancaire), Cloudinary a un plan gratuit sans carte bancaire du tout.

Mise en place complète : voir **`web/firebase/README.md`** (base de
données) et **`web/cloudinary/README.md`** (photos/vidéos). Résumé rapide :

1. Créer un projet gratuit sur [console.firebase.google.com](https://console.firebase.google.com),
   activer **Firestore Database** (mode production), publier
   `web/firebase/firestore.rules` (refuse tout accès direct du navigateur —
   seule la clé de service, utilisée uniquement côté serveur, peut
   lire/écrire), puis Project Settings → **Comptes de service** → générer
   une clé privée → copier `project_id`/`client_email`/`private_key` vers
   `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`.
2. Créer un compte gratuit sur [cloudinary.com](https://cloudinary.com)
   (aucune carte requise), créer un **upload preset non signé**, copier le
   cloud name et le nom du preset vers `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
   et `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.
3. Ajouter ces 5 variables dans Vercel (Project Settings → Environment
   Variables) et redéployer.

Voir `.env.example` pour le nom exact de chaque variable.

## Structure

```
app/[locale]/        Pages publiques (fr sans préfixe, /ar, /en)
app/admin/            Tableau de bord interne (non traduit, protégé par mot de passe)
app/api/              Route handlers (leads, admin)
components/           Composants UI, sections de page, formulaires
config/site.config.ts Configuration centrale (coordonnées, SEO)
data/                 Données de démonstration (machines, réalisations, articles)
lib/                  Accès aux données, i18n helpers, Firebase (Firestore + Storage)
firebase/             Règles de sécurité + guide de mise en place Firestore
cloudinary/           Guide de mise en place du stockage photos/vidéos
messages/             Traductions fr.json / ar.json / en.json
```

## Machines et réalisations : aucune donnée fictive

- `data/machines.json` et `data/projects.json` sont **vides par défaut** —
  aucune machine ni réalisation inventée n'est publiée sur le site. Tant
  qu'ils sont vides, les pages `/machines`, `/realisations` et la page
  d'accueil affichent un état vide honnête (« Aucune machine disponible
  actuellement », etc.) avec un appel à l'action vers WhatsApp/contact.
- Les machines ajoutées depuis `/admin` (onglet **Machines**) sont
  persistées dans Firestore (voir section précédente) et apparaissent
  immédiatement sur le site public (ajout fait par un admin authentifié =
  publication directe).
- **Statut unique.** Une machine a un seul champ `status`, partout le même
  nom côté base de données, API et interface admin :
  `draft` (brouillon/masquée) → `pending` (en attente de validation) →
  `published` (publiée) / `rejected` (rejetée), puis `reserved`
  (réservée) / `sold` (vendue) une fois publiée. Le site public
  (`lib/data.ts` → `getPublicMachines()`) n'affiche que
  `published`/`reserved`/`sold` ; `draft`/`pending`/`rejected` ne sont
  jamais visibles hors de `/admin`.
- **Modération obligatoire pour les annonces de vendeurs.** Le formulaire
  public `/vendre-machine` ne publie jamais rien directement : chaque
  soumission crée une machine avec `status: "pending"`, invisible sur
  `/machines`, la page d'accueil, la page détail et le sitemap tant qu'un
  admin ne l'a pas approuvée. L'admin consulte les
  annonces en attente dans l'onglet **« Annonces à valider »** (badge de
  compteur en temps réel — c'est la notification actuelle ; voir
  `lib/notifications.ts` pour le point d'extension email/WhatsApp une fois
  des identifiants disponibles) avec toutes les infos envoyées (machine,
  photos, vidéo) et les coordonnées du vendeur, et choisit **Approuver &
  publier**, **Rejeter** (avec note interne) ou **Demander des
  modifications** (repasse en brouillon avec une note, toujours modifiable
  et re-soumettable à validation).

## Intermédiation contrôlée par Jimi (marketplace)

Le site n'est **pas** une petite annonce classique en libre-service : Jimi
reste l'intermédiaire entre acheteur et vendeur à chaque étape.

- **Vendeur** (`lib/sellers.ts`) et **Acheteur** (`lib/buyers.ts`) sont des
  fiches privées séparées, dédupliquées par numéro de téléphone (pas de
  compte/connexion vendeur ou acheteur). Elles ne sont **jamais** intégrées
  dans un objet `Machine` — seule une référence opaque (`sellerId`) y est
  stockée.
- **`PublicMachine`** (`lib/data.ts`) est une projection *allow-list* : toute
  machine qui atteint une page publique ou un composant client (donc le
  bundle envoyé au navigateur) passe par `toPublicMachine()`, qui ne
  recopie que les champs explicitement autorisés. Un nouveau champ privé
  ajouté plus tard à `Machine` reste donc exclu par défaut — la vie privée
  est appliquée côté données, pas seulement cachée côté UI.
- Sur une fiche machine publique, le bouton **« Je suis intéressé »**
  (`components/MachineInterestForm.tsx`) ouvre un formulaire acheteur
  (nom, entreprise, téléphone, WhatsApp, email, wilaya, message) qui POST
  vers `/api/machine-interest` : il crée/retrouve un `BuyerProfile` et un
  **`MachineLead`** (`lib/machineLeads.ts`) reliant acheteur + machine +
  vendeur, avec un statut (`NEW` → `CONTACTED` → `QUALIFIED` →
  `VISIT_SCHEDULED` → `NEGOTIATION` → `SOLD`/`LOST`) et une commission
  interne (type, valeur, montant attendu, statut de paiement). Le vendeur
  n'est **jamais** nommé ni contacté directement depuis cette page.
- Dans `/admin`, les onglets **Vendeurs**, **Acheteurs** et **Leads**
  affichent les coordonnées complètes et permettent d'appeler/écrire sur
  WhatsApp chaque partie séparément — c'est Jimi qui décide quand (et si)
  mettre en relation directe acheteur et vendeur ; rien n'est automatique.
  L'onglet **Machines** permet aussi de **masquer** une annonce déjà
  publiée sans la supprimer (icône œil barré).
- Pour ajouter de vraies réalisations, éditez directement
  `data/projects.json` (structure prête, voir `lib/types.ts`) — il n'y a
  pas encore d'interface admin dédiée pour celles-ci.
- Chaque machine peut avoir sa propre vidéo (section « Voir la machine en
  fonctionnement » sur sa page, badge « Vidéo disponible » sur sa carte) et
  plusieurs photos. Sur `/vendre-machine`, le vendeur choisit ses photos et
  sa vidéo directement depuis la galerie/l'appareil de son téléphone
  (`components/forms/MediaUploader.tsx`) : les fichiers sont envoyés
  directement du navigateur vers Cloudinary (avec une vraie barre de
  progression par fichier), jamais en base64 ni via `localStorage` — voir
  `web/cloudinary/README.md` pour les limites de taille/type appliquées
  (configurées côté "upload preset" Cloudinary, pas dans ce dépôt). La
  première photo de la liste est la **photo
  principale** (réordonnable, un bouton dédié permet d'en choisir une
  autre) et c'est elle qui apparaît sur la carte, la page d'accueil, la
  fiche détail et l'aperçu Open Graph. Un lien YouTube/Vimeo/MP4 direct
  reste aussi accepté pour la vidéo (`lib/video.ts`).

## Pièces industrielles

En complément du catalogue de machines, `/pieces-industrielles` présente un
second catalogue, plus simple, de pièces détachées réparties en 4 catégories
fixes : **Électronique & électricité**, **Moules**, **Hydraulique**,
**Mécanique** (`lib/types.ts` → `Part`, `PartCategory`). Contrairement aux
machines, il n'y a pas de soumission publique ni de modération : c'est un
catalogue géré uniquement depuis `/admin` (onglet **Pièces**), persistant
dans Firestore comme le reste (`lib/partsStore.ts`, même bascule Firestore ⇄
fichier temporaire que `lib/machinesStore.ts`). Chaque pièce publiée
(référence, état neuf/occasion/rénové, prix ou prix sur demande, photos)
apparaît immédiatement dans sa catégorie ; les boutons **Demander le prix**
(WhatsApp pré-rempli) et **Contact** permettent de joindre Jimi sans jamais
exposer de formulaire de vente publique pour les pièces.

## Tableau de bord admin

Accessible sur `/admin` (mot de passe défini par `ADMIN_PASSWORD`, valeur par
défaut `jimi-admin-2026` si non configuré — **à changer avant mise en
production**). Permet de :

- consulter et traiter les demandes reçues (achat, vente, service, contact) ;
- valider/rejeter/masquer les annonces de vendeurs (onglet **Annonces à
  valider**) ;
- ajouter / modifier le statut / masquer / supprimer des machines
  (onglet **Machines**) ;
- ajouter / publier / masquer / supprimer des pièces industrielles
  (onglet **Pièces**) ;
- consulter les fiches vendeurs et acheteurs avec leurs coordonnées
  privées (onglets **Vendeurs**, **Acheteurs**) ;
- gérer le pipeline de deals et la commission de chaque mise en relation
  (onglet **Leads**) ;
- consulter les informations de configuration de l'entreprise.

## SEO

Métadonnées par page, données structurées JSON-LD (Organization, Product,
Article), `sitemap.xml` et `robots.txt` générés automatiquement
(`app/sitemap.ts`, `app/robots.ts`).
