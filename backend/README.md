# JIMI B2B — Backend API

NestJS + Prisma + PostgreSQL. Voir [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
et [`../docs/DATABASE.md`](../docs/DATABASE.md) pour la conception complète.

## Démarrage local

```bash
cp .env.example .env   # renseigner DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
npm install
npx prisma migrate dev
npx prisma db seed      # crée le premier compte ADMIN (voir sortie console pour les identifiants)
npm run start:dev
```

L'API écoute sur `http://localhost:3000/api`.

## Modules

| Module | Rôle |
|---|---|
| `auth` | Login, refresh token (rotation), logout |
| `clients` | Admin crée/gère les comptes clients ; client consulte son propre profil |
| `categories` | Arborescence catégories |
| `products` | CRUD Admin (avec prixAchat/stockReel) + catalogue Client (prix résolu, stock dérivé) |
| `pricing` | `PricingService` — résolution du prix (promo > prix perso > palier > normal), seule source de vérité |
| `promotions` | Promotions ciblées produit/client |
| `favorites` | Produits favoris du client |
| `uploads` | Upload d'images produit (caméra/gallery côté mobile) |
| `orders` | Cycle de vie de la commande, transitions de statut validées, mouvements de stock automatiques |
| `stock` | Mouvements manuels (Entrée/Sortie/Retour/Ajustement), historique, alerte stock faible |
| `payments` | Règlements clients, mise à jour du solde crédit |
| `notifications` | Notifications in-app (nouvelle commande, statut, stock faible) |
| `stats` | Dashboard Admin (CA, bénéfice, marge, top produits/clients, stock faible) |
| `export` | Export Excel (produits, commandes, clients) |

## Garantie de sécurité vérifiée

Chaque réponse "vue Client" passe par un mapper allow-list dédié
(`toClientProductDTO`, `toClientOrderDTO`, `toSelfClientDTO`, …) — voir
`docs/ARCHITECTURE.md` §3. Testé manuellement de bout en bout : un token
CLIENT ne peut ni lire `prixAchat`/`marge`/`stockReel`, ni accéder aux
routes Admin (`/stats`, `/clients`, `/products` liste complète), qui
répondent `403`.
