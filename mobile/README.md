# JIMI B2B — Application mobile (Flutter)

Un seul codebase Flutter pour les deux espaces (Admin/Owner et Client) —
le rôle vient exclusivement du token JWT retourné par le backend au login
(`lib/core/auth/auth_controller.dart`), jamais d'un choix fait dans l'app.

## Démarrage local

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://<ip-machine-dev>:3000/api
```

Par défaut (`lib/core/config/app_config.dart`), l'app pointe vers
`http://10.0.2.2:3000/api` (boucle de l'émulateur Android vers le
`localhost` de la machine hôte où tourne le backend). Sur un téléphone
physique ou pour l'API de production, passez `--dart-define=API_BASE_URL=...`.

## Structure

```
lib/
  core/            Config, client API (Dio + refresh JWT), stockage sécurisé
                    des tokens, contrôleur d'authentification, thème,
                    offline (SQLite + file de sync), push (FCM optionnel)
  models/          Modèles de données (parsing JSON du backend)
  services/        Un client par ressource API (ProductsApi, OrdersApi, ...)
  features/
    auth/          Écran de connexion
    admin/         Espace Admin (dashboard, produits, commandes, clients,
                    stock, promotions, export)
    client/        Espace Client (catalogue, recherche photo/voix, panier,
                    commandes, favoris, profil)
    shared/        Notifications (écran commun aux deux rôles)
```

## Offline & synchronisation

- **Catalogue** : chaque recherche réussie met en cache les produits
  (SQLite, `core/offline/app_database.dart`) ; si le réseau échoue, l'écran
  Catalogue retombe sur le cache local avec un bandeau "Mode hors-ligne".
- **Panier** : persisté en local, survit à un redémarrage de l'app.
- **Commande hors-ligne** : si l'appareil est hors-ligne à la validation du
  panier, la commande est mise en file d'attente locale
  (`pending_orders`) au lieu d'être perdue — écran de confirmation dédié
  (`OfflineOrderQueuedScreen`), visible aussi dans l'onglet Commandes. Dès
  que la connectivité revient (`connectivity_plus`), `SyncService` renvoie
  automatiquement chaque commande en attente via l'API normale (qui
  recalcule prix/stock à ce moment-là — jamais figés côté mobile).

## Recherche par photo / voix

- **Photo** (`features/client/catalog/image_search_screen.dart`) : le
  client prend une photo ou en choisit une dans la galerie, l'app l'envoie
  à `POST /products/catalog/search-image` et affiche les produits les plus
  proches avec un score de similarité (voir `backend` — hash perceptuel).
- **Voix** (`voice_search_button.dart`, bouton micro dans la barre de
  recherche du catalogue) : transcription 100% sur l'appareil
  (`speech_to_text`), le texte reconnu alimente ensuite la recherche texte
  classique — aucun audio n'est envoyé au serveur.

## Notifications push (optionnel)

Fonctionne sans aucune configuration : les notifications restent
disponibles in-app. Pour activer le push FCM, voir `docs/DEPLOYMENT.md` §2
— aucun fichier `google-services.json`/plugin Gradle requis côté Android,
l'initialisation Firebase se fait par options explicites
(`--dart-define=FIREBASE_*`, voir `lib/core/config/app_config.dart`).

## Sécurité

Le rôle ne pilote que quel `Shell` (Admin/Client) s'affiche. Chaque appel
API repart avec le token JWT du compte connecté ; c'est le **backend** qui
décide seul ce qui est renvoyé (voir `docs/ARCHITECTURE.md` §3) — l'app
mobile ne fait jamais de filtrage de champs sensibles côté client, elle
affiche simplement ce que l'API a déjà limité.

## État d'avancement (voir `../docs/ARCHITECTURE.md` §12)

- [x] Auth (login, refresh automatique, déconnexion), navigation par rôle
- [x] Espace Admin : dashboard, produits (CRUD + photos caméra/gallery +
      grille de prix), commandes (statuts), clients (CRUD + prix
      personnalisé + suspension), stock (mouvements + alertes), promotions,
      export Excel, notifications
- [x] Espace Client : catalogue (recherche texte + filtres), fiche produit,
      panier, commande (paiement + livraison), historique + "commander à
      nouveau", favoris, profil (crédit, notifications)
- [x] Offline/synchronisation (cache catalogue, panier persisté, file de
      commandes hors-ligne), recherche par image/voix, notifications push
      (FCM, optionnel)
