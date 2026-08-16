import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/client.dart';
import '../../services/service_providers.dart';

/// The logged-in client's own profile — shared across screens that need to
/// know their price category (e.g. catalog/cart deciding carton vs unit
/// ordering, see Phase 30) so they don't each fetch it independently.
final clientProfileProvider = FutureProvider.autoDispose<ClientView>((ref) => ref.watch(clientsApiProvider).myProfile());
