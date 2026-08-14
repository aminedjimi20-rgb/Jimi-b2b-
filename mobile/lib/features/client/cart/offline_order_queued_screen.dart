import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

/// Shown after a client submits an order while offline — there is no
/// server-confirmed order yet (no reference, no resolved prices), so this
/// intentionally does NOT reuse ClientOrderDetailScreen. SyncService sends
/// the real order automatically once connectivity returns.
class OfflineOrderQueuedScreen extends StatelessWidget {
  const OfflineOrderQueuedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off, size: 64, color: AppTheme.warning),
                const SizedBox(height: 20),
                Text('Commande enregistrée hors-ligne', style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
                const SizedBox(height: 12),
                const Text(
                  "Vous n'avez pas de connexion internet. Votre commande a été sauvegardée sur "
                  'votre téléphone et sera envoyée automatiquement dès que la connexion sera '
                  "rétablie — vous pouvez suivre son état dans l'onglet Commandes.",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 28),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
                  child: const Text("Retour à l'accueil"),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
