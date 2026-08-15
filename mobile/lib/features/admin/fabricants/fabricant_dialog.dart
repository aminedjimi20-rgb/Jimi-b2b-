import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../models/fabricant.dart';
import '../../../services/service_providers.dart';

/// Opens the "new fabricant" dialog and returns the created Fabricant, or
/// null if cancelled — shared by the product form and the goods-receipt form.
Future<Fabricant?> showCreateFabricantDialog(BuildContext context, WidgetRef ref) async {
  final controller = TextEditingController();
  String? error;
  Fabricant? created;

  await showDialog(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        title: const Text('Nouveau fabricant'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: controller,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Nom du fabricant'),
            ),
            if (error != null) ...[
              const SizedBox(height: 8),
              Text(error!, style: const TextStyle(color: AppTheme.danger)),
            ],
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () async {
              final nom = controller.text.trim();
              if (nom.isEmpty) {
                setState(() => error = 'Le nom est requis.');
                return;
              }
              try {
                created = await ref.read(fabricantsApiProvider).create(nom);
                if (ctx.mounted) Navigator.pop(ctx);
              } catch (e) {
                setState(() => error = e is ApiException ? e.message : 'Erreur.');
              }
            },
            child: const Text('Créer'),
          ),
        ],
      ),
    ),
  );

  return created;
}
