# JIMI B2B — Déploiement

## 1. Backend

### Option A — Docker Compose (auto-hébergé, le plus simple)

```bash
cd backend
cp .env.example .env
# éditer .env : JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, SEED_ADMIN_PASSWORD (obligatoires)
docker compose up -d --build
docker compose exec api npx prisma db seed   # crée le premier compte Admin
```

L'API est alors disponible sur `http://<serveur>:3000/api`. Les volumes
`postgres_data`, `uploads_data`, `backups_data` persistent les données, les
photos produits et les sauvegardes entre redéploiements.

> Le `Dockerfile`/`docker-compose.yml` suivent le pattern standard
> NestJS + Prisma multi-stage ; ils n'ont pas pu être exécutés dans cet
> environnement de développement (pas de démon Docker disponible ici) —
> testez `docker compose up -d --build` une première fois avant mise en
> production.

### Option B — PaaS (Railway / Render / Fly.io)

1. Créer un service PostgreSQL managé sur la plateforme.
2. Déployer `backend/` (le `Dockerfile` fourni fonctionne tel quel sur ces
   plateformes) ou utiliser leur buildpack Node.js avec
   `npm run build && npx prisma migrate deploy && npm run start:prod`.
3. Renseigner les variables d'environnement (voir `.env.example`) — au
   minimum `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
4. Lancer `npx prisma db seed` une fois (console de la plateforme ou job
   ponctuel) pour créer le premier compte Admin.

### Checklist sécurité avant mise en production

- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` : secrets aléatoires longs
      (ex: `openssl rand -base64 48`), différents entre eux, jamais commités.
- [ ] `SEED_ADMIN_PASSWORD` changé immédiatement après le premier login.
- [ ] `ALLOWED_ORIGINS` renseigné si un client web/navigateur est exposé
      (Flutter Web, futur back-office) — sinon CORS reste ouvert par défaut
      (sans impact pour l'app mobile, qui n'est pas soumise à CORS).
- [ ] HTTPS en amont (reverse proxy / plateforme) — les tokens JWT et mots
      de passe ne doivent jamais transiter en clair.
- [ ] `BACKUP_DIR` pointé vers un volume durable (voir §3).
- [ ] Sauvegarde testée avec une restauration réelle sur un environnement
      de test (voir §3) avant d'en dépendre en production.

## 2. Application mobile (Flutter)

```bash
cd mobile
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.votre-domaine.com/api
# ou pour le Play Store :
flutter build appbundle --release --dart-define=API_BASE_URL=...
# iOS (nécessite macOS + Xcode) :
flutter build ipa --release --dart-define=API_BASE_URL=...
```

### Notifications push (optionnel)

L'app fonctionne intégralement sans Firebase — les notifications restent
disponibles in-app (écran Notifications). Pour activer le push :

1. Créer un projet Firebase, activer Cloud Messaging.
2. Backend : télécharger la clé de compte de service (Project Settings >
   Service accounts > Generate new private key), la déposer sur le serveur
   et pointer `FIREBASE_SERVICE_ACCOUNT_PATH` dessus.
3. Mobile : récupérer les identifiants Web du projet Firebase (Project
   Settings > General > Your apps > Web app) et les passer au build :
   ```bash
   flutter build apk --release \
     --dart-define=API_BASE_URL=... \
     --dart-define=FIREBASE_API_KEY=... \
     --dart-define=FIREBASE_APP_ID=... \
     --dart-define=FIREBASE_MESSAGING_SENDER_ID=... \
     --dart-define=FIREBASE_PROJECT_ID=...
   ```
   (voir `mobile/lib/core/config/app_config.dart`). L'initialisation
   Firebase se fait par options explicites — pas besoin de
   `google-services.json`/Gradle plugin pour Android ; pour un support
   APNs complet sur iOS, suivez en plus la doc FlutterFire officielle pour
   `GoogleService-Info.plist`.

## 3. Sauvegardes & restauration

- Sauvegarde automatique quotidienne (3h du matin, `BackupService`,
  30 dernières conservées) + déclenchement manuel : `POST /api/backup/run`
  (Admin uniquement, depuis l'app ou `curl`).
- Téléchargement : `GET /api/backup/:filename` (Admin) — à récupérer
  régulièrement vers un stockage hors du serveur (S3/R2, disque externe).
- Restauration — **jamais exposée en API**, action volontaire en ligne de
  commande sur le serveur :
  ```bash
  DATABASE_URL="postgresql://..." ./backend/scripts/restore.sh chemin/vers/backup.sql.gz
  ```

## 4. Export de données

`GET /api/export/{products,orders,clients}` (Admin) génère un classeur
Excel à la volée — utilisé directement depuis l'app mobile (Plus > Export),
qui propose ensuite le partage natif (email, stockage cloud, etc.).
