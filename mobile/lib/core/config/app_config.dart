/// Backend base URL. Override at build/run time with:
///   flutter run --dart-define=API_BASE_URL=https://api.jimi-b2b.example.com/api
class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api', // Android emulator loopback to host localhost
  );
}
