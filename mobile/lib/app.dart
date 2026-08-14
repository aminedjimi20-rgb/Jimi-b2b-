import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth_controller.dart';
import 'core/theme/app_theme.dart';
import 'features/admin/admin_shell.dart';
import 'features/auth/login_screen.dart';
import 'features/client/client_shell.dart';

/// App root — the ONLY place that decides which shell to show, based on
/// AuthController's state. Role-based navigation is a UX convenience:
/// even if this were somehow bypassed, every backend endpoint re-checks
/// the JWT's role independently (see docs/ARCHITECTURE.md §3).
class JimiApp extends ConsumerWidget {
  const JimiApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authStatus = ref.watch(authControllerProvider);

    return MaterialApp(
      title: 'JIMI B2B',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: switch (authStatus) {
        AuthLoading() => const _SplashScreen(),
        AuthUnauthenticated() => const LoginScreen(),
        AuthAuthenticated(role: UserRole.admin) => const AdminShell(),
        AuthAuthenticated(role: UserRole.client) => const ClientShell(),
      },
    );
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
