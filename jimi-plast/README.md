# JIMI PLAST

Plateforme de gestion commerciale JIMI PLAST — catalogue, clients, fabricants,
stock, bons, crédits, retours, transport, statistiques. Projet neuf,
indépendant de `web/` (Jimi Renovation & Installation / jimi industrie) et de
`backend/` + `mobile/` (JIMI B2B) présents ailleurs dans ce dépôt.

## Structure

```
jimi-plast/
├── api/    API NestJS + Prisma/PostgreSQL
└── app/    Next.js — catalogue public + espaces Admin/Employé/Grossiste/Détaillant
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

## En ligne

- App : https://jimi-plast-app.vercel.app
- API : https://jimi-plast-api.onrender.com/api

## Déploiement en ligne (Render + Vercel, gratuit)

Deux boutons suffisent : aucun mot de passe ni jeton n'est partagé avec Claude,
tout se passe sur le compte de l'utilisateur.

1. **API + base de données** → cliquer sur
   [Déployer l'API sur Render](https://render.com/deploy?repo=https://github.com/aminedjimi20-rgb/Jimi-b2b-)
   (le fichier `render.yaml` à la racine du dépôt provisionne automatiquement
   le service web NestJS et la base PostgreSQL, exécute les migrations puis
   le seed). Une fois déployé, noter l'URL du service, par ex.
   `https://jimi-plast-api.onrender.com`.
2. **Application web** → cliquer sur
   [Déployer l'app sur Vercel](https://vercel.com/new/clone?repository-url=https://github.com/aminedjimi20-rgb/Jimi-b2b-&root-directory=jimi-plast/app&project-name=jimi-plast-app&env=NEXT_PUBLIC_API_URL&envDescription=URL+de+l%27API+JIMI+PLAST+(Render)%2C+ex+%3A+https://jimi-plast-api.onrender.com/api)
   et renseigner `NEXT_PUBLIC_API_URL` = `<url-render>/api` quand Vercel le
   demande. Une fois déployé, noter l'URL Vercel, par ex.
   `https://jimi-plast-app.vercel.app`.
3. Retourner sur Render → service `jimi-plast-api` → *Environment* → modifier
   `WEB_APP_ORIGIN` avec l'URL Vercel exacte de l'étape 2 → sauvegarder (le
   service redémarre automatiquement, ce qui active le CORS pour l'app).
4. Ouvrir l'URL Vercel : connexion avec `admin@jimiplast.dz` /
   `ChangeMe123!` (à changer immédiatement depuis *Mon compte*).

Les deux services ont un plan gratuit qui se met en veille après inactivité
(le premier chargement peut prendre ~30s le temps que l'API se réveille).

## État d'avancement

- [x] **Phase 1 — Fondations** : auth JWT (access + refresh rotatif),
  rôles (ADMIN/EMPLOYEE/WHOLESALER/RETAILER) + permissions granulaires
  configurables, demandes d'inscription avec validation Admin, audit log,
  corbeille générique, numérotation centralisée de documents, i18n
  FR/AR/EN + RTL, adaptateur de notifications.
- [x] **Phase 2 — Catalogue & tarification** : catégories, produits,
  conditionnement pièce/carton, prix usine/gros/détail configurables,
  historique de prix, promotions, priorité d'affichage auto + manuelle,
  catalogue public.
- [x] **Phase 3 — Clients & comptes** : dossier client (créé
  automatiquement à l'acceptation d'une demande), solde toujours
  recalculé depuis le journal des écritures, paiements et ajustements
  manuels, espace "Mon compte" pour le client.
- [x] **Phase 4 — Ventes & bons** : bons de vente avec conditionnement
  réel (cartons -> pièces), brouillons à sauvegarde automatique,
  confirmation qui décrémente le stock et crée les écritures crédit en
  transaction, annulation qui réintègre proprement, génération PDF
  professionnelle côté serveur.
- [x] **Phase 5 — Fabricants & achats** : dossier fabricant, bons
  d'achat avec le même mécanisme de conditionnement, réception qui
  incrémente le stock et met à jour le coût d'achat, journal de stock
  unifié (ventes/achats/corrections), alertes stock faible, correction
  d'inventaire manuelle.
- [x] **Phase 6 — Retours & transport** : retours client/fabricant
  gérés en pièces (jamais en cartons), 4 décisions possibles
  (remboursement/avoir/déduction/remplacement) qui ajustent le crédit
  ou le stock selon le cas, suivi de livraison (chauffeur, statut,
  coût réel vs facturé).
- [x] **Phase 7 — Demandes & négociation** : demande de produit hors
  catalogue avec suivi de statut, négociation de prix avec capture
  automatique du tarif catalogue du client et réponse
  accepter/refuser/contre-offre.
- [x] **Phase 8 — Notifications internes** : centre de notifications
  par utilisateur (cloche, non-lues, marquage lu), alimenté par un
  nouveau canal branché sur l'adaptateur de notifications de la
  Phase 1 sans toucher au code métier existant.
- [x] **Phase 9 — Statistiques & dashboard** : chiffre d'affaires,
  marge réelle, panier moyen, top produits, crédit clients/dette
  fournisseurs, alertes — le tout recalculé depuis les journaux
  existants, jamais stocké en dur.
- [x] **Phase 10 — Durcissement** : 0 vulnérabilité (`npm audit`) sur
  les deux projets, build de production vérifié, parcours critiques
  retestés de bout en bout après l'ajout de chaque module.

## Limites connues / suite naturelle

- Les brouillons de bons se sauvegardent automatiquement côté serveur
  à chaque modification, mais il n'y a pas encore de sauvegarde locale
  côté appareil en cas de coupure réseau avant l'enregistrement.
- La contre-offre acceptée lors d'une négociation n'est pas encore
  appliquée automatiquement comme prix par défaut dans un bon de
  vente — à reporter manuellement pour l'instant.
- Pas encore de formulaire côté client pour créer sa propre demande de
  produit ou négociation depuis son espace (l'API est prête et
  testée ; seul l'écran manque).
- Notifications WhatsApp/email : l'architecture par adaptateur est en
  place (voir `src/notifications/`) mais seul le canal interne et la
  console sont branchés — il suffit d'ajouter une classe implémentant
  `NotificationChannel` pour brancher un vrai canal WhatsApp Business
  ou email, sans toucher au reste du code.
- Pas de tests automatisés (unitaires/e2e) ni de CI — tout a été
  vérifié manuellement (API + navigateur réel) à chaque phase.
- Photos de produits/bons : l'upload direct depuis l'app (caméra) n'est
  pas encore branché à un stockage objet ; les images se gèrent
  aujourd'hui par URL.
- Corbeille : l'infrastructure (`TrashService`) existe depuis la
  Phase 1 et est utilisée par Produits/Catégories/Clients/Fabricants,
  mais il n'y a pas encore d'écran "Corbeille" pour restaurer depuis
  l'interface (à faire via l'API pour l'instant).
