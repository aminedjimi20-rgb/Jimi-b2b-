# Mise en place de Firebase (une seule fois)

Sans cette étape, le site utilise un stockage temporaire qui ne survit pas
entre deux requêtes sur Vercel — c'est ce qui causait la disparition des
machines après une action admin (Approve, etc.). Une fois Firebase configuré,
tout est persistant : machines, vendeurs, acheteurs, leads, photos, vidéos.

## 1. Créer le projet

1. Aller sur [console.firebase.google.com](https://console.firebase.google.com)
   et cliquer **Ajouter un projet**. Le plan gratuit (Spark) suffit pour
   démarrer ; si le volume de photos/vidéos grandit, passer au plan **Blaze**
   (paiement à l'usage, avec un quota gratuit généreux inclus) — Storage
   exige Blaze au-delà d'un usage minime.
2. Nom du projet libre (ex. `jimi-renovation`).

## 2. Activer Firestore

1. Dans le menu de gauche : **Build → Firestore Database → Créer une base
   de données**.
2. Choisir **Mode production** (pas "mode test" — les règles de sécurité de
   ce dossier gèrent déjà les accès correctement).
3. Choisir une région proche (ex. `eur3` pour l'Europe).
4. Une fois créée, onglet **Règles** → coller le contenu de
   [`firestore.rules`](./firestore.rules) → **Publier**.

## 3. Activer Storage

1. **Build → Storage → Commencer**.
2. Même région que Firestore de préférence.
3. Onglet **Règles** → coller le contenu de [`storage.rules`](./storage.rules)
   → **Publier**.

## 4. Générer la clé de compte de service (accès serveur)

1. Icône ⚙️ → **Paramètres du projet → Comptes de service**.
2. **Générer une nouvelle clé privée** → télécharge un fichier JSON.
3. Dans ce fichier, récupérer 3 valeurs pour les variables serveur (jamais
   exposées au navigateur) :
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (coller la valeur telle quelle,
     guillemets et `\n` inclus — voir `.env.example` pour le format exact)
4. **Ne jamais commiter ce fichier JSON dans Git.**

## 5. Récupérer la config publique (accès navigateur)

1. **Paramètres du projet → Général**, section **Vos applications**.
2. Si aucune app web n'existe : cliquer `</>` pour en créer une (pas besoin
   d'Hosting Firebase, juste la config SDK).
3. Copier les valeurs vers :
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`

Ces 4 valeurs sont publiques par conception (elles identifient le projet,
ce ne sont pas des secrets) — ce qui protège réellement les données, ce sont
les règles publiées aux étapes 2 et 3.

## 6. Configurer Vercel

Project Settings → Environment Variables → ajouter les 7 variables
ci-dessus (voir `.env.example` pour la liste complète avec leurs noms
exacts), puis redéployer.

## Vérifier que ça marche

Après redéploiement : soumettre une machine depuis `/vendre-machine`,
l'approuver depuis `/admin`, rafraîchir la page, se déconnecter/reconnecter
de `/admin` — la machine doit toujours être là. Uploader une photo doit
afficher une barre de progression puis un aperçu réel de l'image.
