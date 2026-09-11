# JIMI PLAST

Plateforme de gestion commerciale JIMI PLAST — catalogue, clients, fabricants,
stock, bons, crédits, retours, transport, statistiques. Projet neuf,
indépendant de `web/` (Jimi Renovation & Installation) et de `backend/` +
`mobile/` (JIMI B2B) présents ailleurs dans ce dépôt.

Architecture complète, modèle de données, rôles/permissions et plan de
développement par phases : voir le document de conception partagé avec
l'utilisateur (Blueprint JIMI PLAST).

## Structure

```
jimi-plast/
├── api/    API NestJS + Prisma/PostgreSQL
├── app/    Next.js — catalogue public + espaces Admin/Employé/Grossiste/Détaillant
└── docs/   Notes de conception complémentaires
```

## Démarrage local

### API

```bash
cd api
cp .env.example .env   # adapter DATABASE_URL si besoin
npm install
npx prisma migrate dev
npm run prisma:seed
npm run start:dev       # http://localhost:3001/api
```

Compte admin créé par le seed : `admin@jimiplast.dz` / `ChangeMe123!`
(à changer immédiatement — configurable via `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD`).

### App web

```bash
cd app
npm install
npm run dev              # http://localhost:3000
```

## État d'avancement

- [x] **Phase 1 — Fondations** : auth JWT (access + refresh rotatif),
  rôles (ADMIN/EMPLOYEE/WHOLESALER/RETAILER) + permissions granulaires
  configurables, demandes d'inscription avec validation Admin (jamais
  automatique), audit log, corbeille générique (infrastructure prête,
  branchée module par module à partir de la Phase 2), numérotation
  centralisée de documents, i18n FR/AR/EN + RTL, adaptateur de
  notifications (canal console pour l'instant, WhatsApp en Phase 8).
- [ ] Phase 2 — Catalogue & tarification
- [ ] Phase 3 — Clients & comptes
- [ ] Phase 4 — Ventes & bons
- [ ] Phase 5 — Fabricants & achats
- [ ] Phase 6 — Retours & transport
- [ ] Phase 7 — Demandes & négociation
- [ ] Phase 8 — Notifications (WhatsApp/email)
- [ ] Phase 9 — Statistiques & dashboard
- [ ] Phase 10 — Durcissement (perf, sauvegardes, sécurité, PWA, tests)
