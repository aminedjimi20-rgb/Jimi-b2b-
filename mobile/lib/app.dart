import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth_controller.dart';
import 'core/offline/connectivity_provider.dart';
import 'core/offline/sync_service.dart';
import 'core/providers.dart';
import 'core/theme/app_theme.dart';
import 'features/admin/admin_shell.dart';
import 'features/auth/login_screen.dart';
import 'features/client/client_shell.dart';
import 'features/client/orders/client_orders_screen.dart';
import 'features/employee/employee_shell.dart';

/// App root — the ONLY place that decides which shell to show, based on
/// AuthController's state. Role-based navigation is a UX convenience:
/// even if this were somehow bypassed, every backend endpoint re-checks
/// the JWT's role independently (see docs/ARCHITECTURE.md §3).
///
/// Also owns two cross-cutting background concerns that only make sense
/// wired at the root: registering/unregistering this device for push
/// notifications as the session starts/ends, and flushing the offline
/// order queue as soon as connectivity comes back (see core/offline).
class JimiApp extends ConsumerStatefulWidget {
  const JimiApp({super.key});

  @override
  ConsumerState<JimiApp> createState() => _JimiAppState();
}

class _JimiAppState extends ConsumerState<JimiApp> {
  UserRole? _pushRegisteredForRole;

  @override
  Widget build(BuildContext context) {
    final authStatus = ref.watch(authControllerProvider);

    ref.listen<AuthStatus>(authControllerProvider, (previous, next) {
      if (next is AuthAuthenticated && _pushRegisteredForRole != next.role) {
        _pushRegisteredForRole = next.role;
        ref.read(pushServiceProvider).registerForCurrentUser();
      } else if (next is AuthUnauthenticated && _pushRegisteredForRole != null) {
        _pushRegisteredForRole = null;
        ref.read(pushServiceProvider).unregister();
      }
    });

    ref.listen<AsyncValue<bool>>(isOnlineProvider, (previous, next) {
      final wasOffline = previous?.valueOrNull == false;
      final isOnlineNow = next.valueOrNull == true;
      if (wasOffline && isOnlineNow) {
        ref.read(syncServiceProvider).flushPendingOrders().then((sent) {
          if (sent > 0) ref.invalidate(clientOrdersProvider);
        });
      }
    });

    return MaterialApp(
      title: 'JIMI B2B',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      scaffoldMessengerKey: ref.watch(scaffoldMessengerKeyProvider),
      home: switch (authStatus) {
        AuthLoading() => const _SplashScreen(),
        AuthUnauthenticated() => const LoginScreen(),
        AuthAuthenticated(role: UserRole.admin) => const AdminShell(),
        AuthAuthenticated(role: UserRole.client) => const ClientShell(),
        AuthAuthenticated(role: UserRole.employee) => const EmployeeShell(),
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
