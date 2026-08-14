# JIMI B2B — Architecture Complète

## 1. Vue d'ensemble

JIMI B2B est une plateforme de vente en gros (B2B) mobile-first avec deux
types de comptes strictement séparés :

- **ADMIN / OWNER** — gestion complète du catalogue, clients, commandes,
  stock, prix, promotions, finances, statistiques.
- **CLIENT** — catalogue, panier, commandes, historique — scope strictement
  limité à ses propres données et à ses prix personnalisés.

### Choix technique (validé)

| Couche | Choix | Justification |
|---|---|---|
| Mobile app | **Flutter** (Android + iOS, extensible Web) | Un seul codebase, UI riche mobile-first, bonne histoire offline (sqlite local) |
| Backend API | **NestJS (Node.js/TypeScript)** | Structure modulaire (Guards/Interceptors/DTO) idéale pour imposer les règles de sécurité par rôle **au niveau API**, pas seulement UI |
| Base de données | **PostgreSQL** via **Prisma ORM** | Relationnel, transactions ACID (stock/commandes/paiements), migrations versionnées |
| Auth | **JWT** (access + refresh) avec rôles + `bcrypt` pour les mots de passe | Contrôle total, pas de dépendance à un tiers |
| Fichiers (images produits) | Stockage objet compatible S3 (ex: Cloudflare R2 / S3) | Scalable, URLs signées |
| Notifications push | Firebase Cloud Messaging (FCM) | Gratuit, fiable, multiplateforme — utilisé uniquement comme transport push |
| Offline local (mobile) | SQLite local (`drift`) + file de synchronisation | Consultation catalogue + création commande hors-ligne, sync à la reconnexion |
| Recherche image/voix | Traitement côté device (speech-to-text) + endpoint `/search/image` (à terme : embeddings + pgvector) | Voir §8 |

**Pourquoi pas Firebase/Firestore direct ?** Firestore n'a pas de sécurité
fine "au niveau champ" à l'intérieur d'un même document : un client qui a le
droit de lire un produit lirait aussi son `prixAchat` si ce champ existe
dans le même document, sauf architecture de documents séparés très
contraignante. Avec une API NestJS, **aucune donnée Admin ne transite
jamais vers le client** : le serializer choisit explicitement les champs
renvoyés selon le rôle du token JWT — la sécurité est appliquée côté
serveur, pas cachée côté UI.

---

## 2. Architecture système

```
                         ┌─────────────────────────┐
                         │   Flutter Mobile App     │
                         │  (Admin UI / Client UI)  │
                         │  + SQLite cache offline  │
                         └───────────┬──────────────┘
                                     │ HTTPS (JWT Bearer)
                                     ▼
                         ┌─────────────────────────┐
                         │   NestJS API (REST)      │
                         │  Auth │ Guards │ Roles    │
                         │  Modules par domaine      │
                         └───────────┬──────────────┘
                                     │ Prisma Client
                                     ▼
                         ┌─────────────────────────┐
                         │   PostgreSQL              │
                         └─────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
             Object Storage      FCM (push)      Backups (cron
             (images produits)                   pg_dump → storage)
```

### Structure du monorepo

```
Jimi-b2b-/
├── backend/            # API NestJS
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── auth/
│       ├── users/
│       ├── clients/
│       ├── products/
│       ├── categories/
│       ├── pricing/
│       ├── promotions/
│       ├── orders/
│       ├── stock/
│       ├── payments/
│       ├── notifications/
│       ├── stats/
│       └── common/ (guards, decorators, interceptors)
├── mobile/              # App Flutter
│   └── lib/
│       ├── core/ (api client, storage, auth state, theme)
│       ├── features/
│       │   ├── auth/
│       │   ├── admin/
│       │   └── client/
│       └── main.dart
└── docs/
    ├── ARCHITECTURE.md
    └── DATABASE.md
```

---

## 3. Rôles & Permissions

Deux rôles au niveau `User.role` : `ADMIN`, `CLIENT`. Conçu pour être
extensible plus tard (`EMPLOYEE` avec permissions granulaires, `DELIVERY`).

Chaque endpoint est protégé par :
1. `JwtAuthGuard` — vérifie le token.
2. `RolesGuard` + décorateur `@Roles('ADMIN')` — vérifie le rôle.
3. `OwnershipGuard` (pour endpoints CLIENT) — vérifie que la ressource
   demandée (commande, facture, adresse) appartient bien au client
   authentifié (`clientId === req.user.clientId`), sinon `403`.
4. **Serializers par rôle** — chaque réponse JSON passe par un mapper
   explicite (`toClientDTO()` / `toAdminDTO()`) qui **liste positivement**
   les champs autorisés. Aucun champ n'est renvoyé "par défaut" — principe
   allow-list, pas deny-list. C'est la garantie que `prixAchat`, `marge`,
   `stockReel`, les prix des autres clients, etc. ne peuvent **jamais**
   fuiter, même par erreur de développement future (un champ ajouté au
   modèle Prisma n'est pas exposé tant qu'il n'est pas ajouté explicitement
   au DTO de sortie).

### Exemple concret — Produit

| Champ | Admin API response | Client API response |
|---|---|---|
| id, nom, code, catégorie, description, taille, couleur, marque, images | ✅ | ✅ |
| prixAchat, marge (%, valeur) | ✅ | ❌ jamais sérialisé |
| stockReel (quantité exacte) | ✅ | ❌ → remplacé par statut dérivé `DISPONIBLE / STOCK_LIMITE / RUPTURE` |
| stockMinimum, seuils internes | ✅ | ❌ |
| prix de vente normal | ✅ | ✅ (si pas de prix personnalisé) |
| prix personnalisé de **ce** client | ✅ (avec tous les prix clients) | ✅ (uniquement le sien) |
| prix des **autres** clients | ✅ | ❌ jamais |
| grilles de prix par quantité | ✅ | ✅ (uniquement applicables à ce client) |

Le calcul du "statut stock" (Disponible / Stock limité / Rupture) se fait
**côté serveur** à partir de `stockReel` vs `stockMinimum` — le nombre brut
n'est jamais envoyé au client.

---

## 4. Authentification

- Inscription client : soit auto-inscription avec validation Admin
  (`status: PENDING → ACTIVE`), soit création directe par l'Admin
  (recommandé en B2B : l'Admin crée le compte du client avec ses
  conditions commerciales).
- Login : email/téléphone + mot de passe → `accessToken` (15 min) +
  `refreshToken` (30 jours, stocké hashé en DB, révocable).
- Mots de passe : `bcrypt` (cost 12).
- Refresh token rotation : chaque refresh invalide l'ancien (détection de
  vol).
- Rate limiting sur `/auth/login` (protection brute-force).
- Compte client peut être suspendu par l'Admin (`status: SUSPENDED`) →
  login refusé immédiatement.

---

## 5. Système de prix (cœur métier)

Ordre de résolution du prix appliqué à un produit pour un client donné,
au moment de l'affichage catalogue / ajout panier :

1. **Promotion active** ciblant ce client + ce produit (ou sa catégorie),
   si dans la fenêtre de dates → prix promo.
2. Sinon, **prix personnalisé du client** pour ce produit
   (`ClientProductPrice`), s'il existe.
3. Sinon, **grille de prix par quantité** (`PriceTier`) — ex: 1-5 / 6-23 /
   24-99 / 100+ — appliquée à la quantité commandée.
4. Sinon, **prix de vente normal** du produit.

Ce calcul est fait **côté backend uniquement** (`PricingService`), jamais
côté mobile — le mobile ne fait qu'afficher le prix déjà résolu renvoyé par
l'API. Cela empêche toute manipulation de prix côté client.

---

## 6. Gestion du stock

- `Product.stockReel` — quantité réelle, visible Admin uniquement.
- Mouvements tracés dans `StockMovement` (type: `ENTREE`, `SORTIE`,
  `RETOUR`, `AJUSTEMENT`, `VENTE`) — chaque commande confirmée génère
  automatiquement des `SORTIE`, chaque retour génère un `RETOUR`.
- Une commande ne peut pas dépasser le stock disponible (vérifié en
  transaction Prisma pour éviter les surventes en cas de commandes
  concurrentes).
- Alerte automatique (notification Admin) quand `stockReel <= stockMinimum`.

---

## 7. Commandes — cycle de vie

```
EN_ATTENTE → CONFIRMEE → PREPARATION → PRETE → EXPEDIEE → LIVREE
                 │
                 └──→ ANNULEE (à tout moment avant EXPEDIEE)
```

- Le client crée un `Bon de commande` (status initial `EN_ATTENTE`).
- L'Admin fait progresser le statut ; chaque changement déclenche une
  notification push au client concerné.
- `PaymentMethod` : `ESPECES`, `VIREMENT`, `BARIDIMOB`, `LIVRAISON`,
  `CREDIT`.
- Si `CREDIT` : la commande incrémente le solde `Client.soldeCredit`,
  plafonné par `Client.limiteCredit` défini par l'Admin.

---

## 8. Recherche (catalogue client)

- **Texte** : nom, code, catégorie, prix (full-text index Postgres
  `pg_trgm`).
- **Vocale** : capture côté Flutter (`speech_to_text`, traitement on-device)
  → transcription convertie en requête texte classique.
- **Image** : photo envoyée à `POST /search/image` → Phase 1 : comparaison
  par hash perceptuel (`pHash`) sur les images produits déjà indexées
  (rapide à livrer, pas d'IA lourde) ; Phase 2 (évolutif) : embeddings
  CLIP + `pgvector` pour une similarité sémantique plus robuste. Les deux
  approches sont interchangeables derrière `ImageSearchService` sans
  changer l'API mobile.

---

## 9. Mode Offline & Synchronisation (mobile)

- Cache local SQLite (`drift`) : catalogue (lecture), panier en cours,
  file d'attente d'actions (`SyncQueue`).
- Lecture : l'app affiche toujours les dernières données en cache
  immédiatement, puis rafraîchit en arrière-plan si en ligne
  (stratégie *stale-while-revalidate*).
- Écriture hors-ligne : ajout au panier, création de commande → stockés
  localement avec `status: PENDING_SYNC`, ré-émis vers l'API dès que la
  connectivité revient (`connectivity_plus` + `WorkManager`/retry
  exponentiel). L'Admin ne voit la commande qu'une fois synchronisée.
- Conflits : le serveur reste toujours la source de vérité pour les prix
  et le stock (recalculés à la synchronisation, jamais figés côté mobile).

---

## 10. Export, Backup & Restore

- Export Excel/CSV : `GET /admin/export/products`, `/orders`, `/clients`
  (génération `exceljs`, téléchargement direct).
- Backup : job planifié (cron) → `pg_dump` compressé → upload vers stockage
  objet, rotation (ex: 30 jours glissants).
- Restore : script admin (CLI interne) restaurant un backup daté — action
  destructive, jamais exposée en self-service depuis l'app mobile.

---

## 11. Évolutivité prévue (ne pas casser ces points en développant)

- **Paiement électronique** : `Payment.provider` déjà en enum extensible ;
  ajouter un module `payments/providers/*` sans toucher au reste.
- **Livraison** : entité `Delivery` déjà prévue (liée à `Order`), champ
  `deliveryPersonId` nullable dès maintenant pointant vers `User`.
- **Plusieurs employés** : rôle `EMPLOYEE` avec table `Permission`
  many-to-many déjà anticipée dans le schéma (`UserPermission`).
- **Plusieurs entrepôts** : `Warehouse` + `StockMovement.warehouseId` +
  `ProductStock` (stock par entrepôt) — le schéma actuel démarre avec un
  entrepôt unique implicite mais les tables sont prêtes pour le multi-dépôt
  (voir DATABASE.md, section "Extensions futures").
- **Version Web** : le backend est 100% agnostique du client (REST JSON) —
  Flutter Web réutilise le même code mobile ; un futur frontend web séparé
  (Next.js) consommerait la même API sans changement.

---

## 12. Feuille de route de développement (phases)

- **Phase 0** ✅ Architecture + schéma DB (ce document + `DATABASE.md`)
- **Phase 1** — Backend : Auth, Users/Clients, rôles, guards, serializers
  sécurisés
- **Phase 2** — Backend : Produits, Catégories, Pricing (grilles + prix
  personnalisés), Promotions
- **Phase 3** — Backend : Commandes, Stock, Paiements/Crédit,
  Notifications, Statistiques
- **Phase 4** — Mobile : squelette Flutter, auth, navigation par rôle
- **Phase 5** — Mobile : espace Admin (produits, clients, commandes,
  stock, stats)
- **Phase 6** — Mobile : espace Client (catalogue, panier, commandes,
  favoris, recherche)
- **Phase 7** — Offline/Sync, recherche image/voix, notifications push
- **Phase 8** — Export/Backup, durcissement sécurité, tests, déploiement

Ce document sert de référence pour toutes les phases suivantes — toute
fonctionnalité listée dans la demande initiale doit être traçable ici avant
d'être considérée "hors scope".
