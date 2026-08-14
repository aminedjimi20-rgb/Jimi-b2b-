# JIMI B2B

Application de vente en gros (B2B) avec deux espaces stricts : **Admin/Owner**
et **Client**. Voir la conception complète dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
et [`docs/DATABASE.md`](docs/DATABASE.md).

## Structure du monorepo

```
backend/   API NestJS + Prisma + PostgreSQL (voir backend/README.md)
mobile/    Application Flutter (Admin + Client)
docs/      Architecture, schéma de base de données, feuille de route
```

## État d'avancement

- [x] Phase 0 — Architecture & schéma de base de données
- [x] Phase 1 — Backend : Auth, Users, Clients, rôles/guards
- [x] Phase 2 — Backend : Produits, Catégories, Pricing, Promotions
- [x] Phase 3 — Backend : Commandes, Stock, Paiements, Notifications, Stats, Export
- [ ] Phase 4 — Mobile : squelette Flutter, auth, navigation par rôle
- [ ] Phase 5 — Mobile : espace Admin
- [ ] Phase 6 — Mobile : espace Client
- [ ] Phase 7 — Offline/Sync, recherche image/voix, notifications push
- [ ] Phase 8 — Export/Backup, durcissement, déploiement

Détail des phases : voir `docs/ARCHITECTURE.md` §12.
