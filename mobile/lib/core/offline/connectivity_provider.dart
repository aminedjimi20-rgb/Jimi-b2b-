import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// True once we have at least one non-"none" connectivity result. Not a
/// guarantee of actual internet reachability (captive portals etc.), but
/// good enough to decide "try the network" vs "queue for later" — a
/// failed network call after this returns true just falls back to the
/// same offline-queue path anyway.
final isOnlineProvider = StreamProvider<bool>((ref) {
  return Connectivity().onConnectivityChanged.map((results) => !results.contains(ConnectivityResult.none));
});

Future<bool> isCurrentlyOnline() async {
  final results = await Connectivity().checkConnectivity();
  return !results.contains(ConnectivityResult.none);
}
