# Mise en place de Firebase Firestore (une seule fois)

Sans cette étape, le site utilise un stockage temporaire qui ne survit pas
entre deux requêtes sur Vercel — c'est ce qui causait la disparition des
machines après une action admin (Approve, etc.). Une fois Firestore
configuré, tout est persistant : machines, vendeurs, acheteurs, leads.

Aucune carte bancaire n'est requise : Firestore fonctionne sur le plan
gratuit (Spark). (Les photos/vidéos, elles, sont hébergées sur Cloudinary —
voir `web/cloudinary/README.md` — car Firebase Storage exige le plan payant
Blaze.)

## 1. Créer le projet

1. Aller sur [console.firebase.google.com](https://console.firebase.google.com)
   et cliquer **Ajouter un projet**.
2. Nom du projet libre (ex. `jimi-renovation`).
3. Google Analytics : pas nécessaire, peut être désactivé.

## 2. Activer Firestore

1. Dans le menu de gauche : **Build → Firestore Database → Créer une base
   de données**.
2. **ID de la base de données** : laisser `(default)` — ne rien taper dans
   ce champ.
3. Choisir **Mode production** (pas "mode test" — les règles de sécurité de
   ce dossier gèrent déjà les accès correctement).
4. Choisir une région proche (ex. `eur3` pour l'Europe — ce choix est
   définitif, impossible à changer ensuite).
5. Une fois créée, onglet **Règles** → vérifier que le contenu correspond à
   [`firestore.rules`](./firestore.rules) (Firebase le propose déjà par
   défaut en mode production) → **Publier** si besoin.

## 3. Générer la clé de compte de service (accès serveur)

1. Icône ⚙️ → **Paramètres du projet → Comptes de service**.
2. **Générer une nouvelle clé privée** → télécharge un fichier JSON.
3. Dans ce fichier, récupérer 3 valeurs pour les variables serveur (jamais
   exposées au navigateur) :
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (coller la valeur telle quelle,
     guillemets et `\n` inclus — voir `.env.example` pour le format exact)
4. **Ne jamais commiter ce fichier JSON dans Git.**

## 4. Configurer Vercel

Project Settings → Environment Variables → ajouter les 3 variables
ci-dessus (voir `.env.example`), puis redéployer.

## Vérifier que ça marche

Après redéploiement : soumettre une machine depuis `/vendre-machine`,
l'approuver depuis `/admin`, rafraîchir la page, se déconnecter/reconnecter
de `/admin` — la machine doit toujours être là.
