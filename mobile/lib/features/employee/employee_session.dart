import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/employee_permissions.dart';
import '../../services/service_providers.dart';

/// The logged-in Employee's own granted permissions — shared across screens
/// that need to show/hide an entry point (e.g. "Bon d'entrée", see Phase 38)
/// so they don't each fetch it independently. The real enforcement always
/// happens server-side, this is purely a UX convenience.
final employeePermissionsProvider = FutureProvider.autoDispose<EmployeePermissions>((ref) {
  return ref.watch(employeesApiProvider).myPermissions();
});
