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
                    des tokens, contrôleur d'authentification, thème
  models/          Modèles de données (parsing JSON du backend)
  services/        Un client par ressource API (ProductsApi, OrdersApi, ...)
  features/
    auth/          Écran de connexion
    admin/         Espace Admin (dashboard, produits, commandes, clients,
                    stock, promotions, export)
    client/        Espace Client (catalogue, panier, commandes, favoris,
                    profil)
    shared/        Notifications (écran commun aux deux rôles)
```

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
- [ ] Offline/synchronisation, recherche par image/voix, notifications push
      (FCM) — Phase 7
