# JIMI B2B

Application de vente en gros (B2B) avec deux espaces stricts : **Admin/Owner**
et **Client**. Voir la conception complète dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/DATABASE.md`](docs/DATABASE.md) et le déploiement dans
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Structure du monorepo

```
backend/   API NestJS + Prisma + PostgreSQL (voir backend/README.md)
mobile/    Application Flutter (Admin + Client, voir mobile/README.md)
docs/      Architecture, schéma de base de données, déploiement
```

## État d'avancement

- [x] Phase 0 — Architecture & schéma de base de données
- [x] Phase 1 — Backend : Auth, Users, Clients, rôles/guards
- [x] Phase 2 — Backend : Produits, Catégories, Pricing, Promotions
- [x] Phase 3 — Backend : Commandes, Stock, Paiements, Notifications, Stats, Export
- [x] Phase 4 — Mobile : squelette Flutter, auth, navigation par rôle
- [x] Phase 5 — Mobile : espace Admin
- [x] Phase 6 — Mobile : espace Client
- [x] Phase 7 — Offline/Sync, recherche image/voix, notifications push
- [x] Phase 8 — Export/Backup, durcissement, déploiement

Détail des phases : voir `docs/ARCHITECTURE.md` §12. Le projet est
fonctionnellement complet par rapport au cahier des charges initial ; les
prochaines étapes naturelles (non demandées) seraient le paiement
électronique, la livraison, les multi-employés/multi-entrepôts déjà
anticipés dans le schéma (voir §11), et le passage en production réelle
(tests automatisés, CI, compte Firebase, hébergement).
