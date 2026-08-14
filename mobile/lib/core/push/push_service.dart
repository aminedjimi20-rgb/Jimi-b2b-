import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../../services/notifications_api.dart';

String _platformName() {
  if (defaultTargetPlatform == TargetPlatform.iOS) return 'IOS';
  if (defaultTargetPlatform == TargetPlatform.android) return 'ANDROID';
  return 'WEB';
}

/// Registers this device for FCM push once a user is logged in, and shows
/// foreground pushes as a snackbar (background/terminated pushes are
/// handled by the OS notification tray automatically). A no-op everywhere
/// if Firebase isn't configured (see AppConfig.pushNotificationsConfigured)
/// — the app never requires a Firebase project to function.
class PushService {
  PushService(this._notificationsApi, this._messengerKey);

  final NotificationsApi _notificationsApi;
  final GlobalKey<ScaffoldMessengerState> _messengerKey;
  String? _currentToken;
  bool _initialized = false;

  Future<void> registerForCurrentUser() async {
    if (!AppConfig.pushNotificationsConfigured) return;

    try {
      if (!_initialized) {
        await Firebase.initializeApp(
          options: FirebaseOptions(
            apiKey: AppConfig.firebaseApiKey,
            appId: AppConfig.firebaseAppId,
            messagingSenderId: AppConfig.firebaseMessagingSenderId,
            projectId: AppConfig.firebaseProjectId,
          ),
        );
        _initialized = true;
      }

      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();

      final token = await messaging.getToken();
      if (token != null) {
        _currentToken = token;
        await _notificationsApi.registerDeviceToken(token, _platformName());
      }

      messaging.onTokenRefresh.listen((newToken) {
        _currentToken = newToken;
        _notificationsApi.registerDeviceToken(newToken, _platformName());
      });

      FirebaseMessaging.onMessage.listen((message) {
        final title = message.notification?.title ?? message.data['title'];
        final body = message.notification?.body ?? message.data['body'];
        if (title == null && body == null) return;
        _messengerKey.currentState?.showSnackBar(
          SnackBar(content: Text([title, body].where((s) => s != null).join(' — '))),
        );
      });
    } catch (_) {
      // Push is a best-effort transport on top of in-app notifications —
      // never let a Firebase/network hiccup here affect the rest of the app.
    }
  }

  Future<void> unregister() async {
    final token = _currentToken;
    if (token == null) return;
    try {
      await _notificationsApi.unregisterDeviceToken(token);
    } catch (_) {
      // best-effort
    }
    _currentToken = null;
  }
}
