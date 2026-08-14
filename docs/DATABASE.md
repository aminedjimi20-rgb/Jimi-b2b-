# JIMI B2B — Database Schema

Source de vérité exécutable : [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).
Ce document décrit les entités et leurs relations en langage clair.

## Entités principales

- **User** — compte de connexion (email/téléphone + mot de passe hashé),
  `role` (`ADMIN` | `CLIENT`, extensible `EMPLOYEE`/`DELIVERY` plus tard),
  `status` (`PENDING` | `ACTIVE` | `SUSPENDED`).
- **Client** — profil métier 1-1 avec un `User` de rôle `CLIENT` :
  raison sociale, adresse(s), téléphone, `limiteCredit`, `soldeCredit`,
  notes internes Admin.
- **Category** — catégories de produits (hiérarchie simple parent/enfant).
- **Product** — fiche produit : nom, code (unique), catégorie, description,
  taille, couleur, marque, images (liste d'URLs), `prixAchat`, `prixVente`,
  `stockReel`, `stockMinimum`, `minCommande`, `actif`.
- **ProductImage** — images liées à un produit (plusieurs par produit,
  pour la caméra/gallery + recherche par image).
- **PriceTier** — grille de prix par palier de quantité, par produit
  (`qteMin`, `qteMax`, `prix`).
- **ClientProductPrice** — prix personnalisé d'un produit pour un client
  précis (override total du prix normal/palier).
- **Promotion** — promotion avec fenêtre de dates, ciblage optionnel
  (produit(s), catégorie(s), client(s)), type (`POURCENTAGE` | `MONTANT`).
- **Order** — commande (bon de commande), `status` (cycle de vie §7 de
  l'architecture), `paymentMethod`, adresse de livraison, totaux calculés
  côté serveur.
- **OrderItem** — ligne de commande : produit, quantité, prix unitaire
  **résolu et figé** au moment de la commande (traçabilité même si le prix
  catalogue change ensuite).
- **StockMovement** — historique des mouvements de stock (`ENTREE`,
  `SORTIE`, `RETOUR`, `AJUSTEMENT`, `VENTE`), toujours lié à un `Product`
  et optionnellement à une `Order`.
- **Payment** — paiements/règlements liés à une commande ou au compte
  client (règlement de crédit), `provider` extensible pour paiement
  électronique futur.
- **Notification** — notifications in-app (nouvelle commande pour Admin,
  changement de statut pour Client, stock faible, etc.).
- **Favorite** — produits favoris/habituels par client.
- **RefreshToken** — jetons de rafraîchissement (hashés), révocables.
- **Warehouse** (extension future) — entrepôts ; `StockMovement.warehouseId`
  et `ProductStock` par entrepôt déjà prévus pour le multi-dépôt.
- **UserPermission** (extension future) — permissions granulaires pour le
  rôle `EMPLOYEE`.
- **Delivery** (extension future) — suivi livraison lié à `Order`.

## Garanties de sécurité au niveau schéma

- Aucune table "vue client" séparée n'est nécessaire : la séparation se
  fait au niveau **DTO/serializer** dans l'API (voir `ARCHITECTURE.md`
  §3), ce qui est plus sûr qu'une duplication de tables (une seule source
  de vérité, zéro risque de désynchronisation entre "vue admin" et "vue
  client").
- `ClientProductPrice` et `Order`/`OrderItem` sont toujours filtrés par
  `clientId = req.user.clientId` dans les requêtes Prisma pour les
  endpoints `CLIENT` — jamais de requête "tous les clients" accessible
  depuis un token `CLIENT`.
