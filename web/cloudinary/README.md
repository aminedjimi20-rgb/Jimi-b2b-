# Mise en place de Cloudinary (une seule fois)

Cloudinary héberge les photos et vidéos des machines. Contrairement à
Firebase Storage (qui exige le plan payant Blaze, avec carte bancaire),
**l'inscription et l'utilisation gratuite de Cloudinary ne demandent aucune
carte bancaire.**

## 1. Créer le compte

1. Aller sur [cloudinary.com](https://cloudinary.com) → **Sign up free**.
2. S'inscrire avec un email ou un compte Google — aucune carte requise.
3. Une fois connecté, le **Dashboard** affiche votre **Cloud name** en haut
   (ex. `djimi-jimi`) → copier vers `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.

## 2. Créer un "upload preset" non signé

C'est ce qui autorise le navigateur du vendeur à envoyer un fichier
directement à Cloudinary sans passer par notre serveur, tout en gardant le
contrôle sur ce qui est accepté (équivalent des règles de sécurité Firebase
Storage).

1. Aller dans **Settings** (⚙️, en haut à droite) → onglet **Upload**.
2. Section **Upload presets** → **Add upload preset**.
3. Configurer :
   - **Signing Mode** : **Unsigned** (obligatoire — sinon l'upload direct
     depuis le navigateur échouera).
   - **Preset name** : donnez-lui un nom simple, ex. `jimi_machines`, et
     copiez-le vers `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.
   - **Folder** : `machines` (optionnel — le code envoie déjà
     `machines/photos` ou `machines/videos`, ceci est une limite
     supplémentaire côté Cloudinary si vous voulez tout confiner sous un
     seul dossier racine).
   - **Allowed formats** : `jpg,png,webp,mp4,webm` pour refuser tout le
     reste.
   - **Max file size** : ex. `15000000` (15 Mo) pour les photos — Cloudinary
     applique cette limite par preset, pas par type de fichier ; si vous
     avez besoin de vidéos plus grosses, augmentez-la en conséquence (ex.
     `200000000` pour 200 Mo) ou créez un second preset dédié aux vidéos.
4. **Save**.

## 3. Configurer Vercel

Ajouter les 2 variables dans Project Settings → Environment Variables :

- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

Redéployer.

## Vérifier que ça marche

Depuis `/vendre-machine`, ajouter une photo : une barre de progression doit
apparaître puis un aperçu réel de l'image. Dans le Dashboard Cloudinary →
**Media Library**, le fichier doit apparaître sous `machines/photos/`.

## Limites du plan gratuit

Le plan gratuit inclut 25 crédits/mois (environ 25 Go de stockage+bande
passante combinés, largement suffisant pour ce volume). Si jamais dépassé,
Cloudinary bloque simplement les nouveaux uploads jusqu'au mois suivant —
aucun risque de facturation surprise sans action explicite de votre part
pour passer à un plan payant.
