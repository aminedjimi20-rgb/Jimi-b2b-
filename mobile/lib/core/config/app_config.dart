/// Backend base URL. Override at build/run time with:
///   flutter run --dart-define=API_BASE_URL=https://api.jimi-b2b.example.com/api
class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api', // Android emulator loopback to host localhost
  );

  /// Push notifications (FCM) are entirely optional — the app works fully
  /// without them (in-app notifications keep working regardless). Leave
  /// these empty to skip Firebase initialization altogether. Populate them
  /// from your own Firebase project's Web app config (Project Settings >
  /// General > Your apps) and pass at build time, e.g.:
  ///   flutter build apk --dart-define=FIREBASE_PROJECT_ID=...
  /// See docs/DEPLOYMENT.md §2 for the full setup.
  static const String firebaseApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const String firebaseAppId = String.fromEnvironment('FIREBASE_APP_ID');
  static const String firebaseMessagingSenderId = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const String firebaseProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');

  static bool get pushNotificationsConfigured => firebaseProjectId.isNotEmpty && firebaseApiKey.isNotEmpty && firebaseAppId.isNotEmpty;
}
