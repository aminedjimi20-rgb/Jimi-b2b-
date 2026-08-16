import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Shown at the top of a form when a saved draft was found — lets the user
/// pick up where they left off or discard it and start fresh.
class DraftResumeBanner extends StatelessWidget {
  const DraftResumeBanner({super.key, required this.onResume, required this.onDismiss});
  final VoidCallback onResume;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return MaterialBanner(
      backgroundColor: AppTheme.warning.withValues(alpha: 0.1),
      leading: const Icon(Icons.history_edu_outlined, color: AppTheme.warning),
      content: const Text('Un brouillon non terminé a été trouvé pour ce formulaire.'),
      actions: [
        TextButton(onPressed: onDismiss, child: const Text('Ignorer')),
        TextButton(onPressed: onResume, child: const Text('Reprendre')),
      ],
    );
  }
}
