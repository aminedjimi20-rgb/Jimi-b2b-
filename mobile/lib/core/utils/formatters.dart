import 'package:intl/intl.dart';

final _currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'DA', decimalDigits: 2);
final _dateFormat = DateFormat('dd/MM/yyyy HH:mm', 'fr_FR');

String formatMoney(double value) => _currencyFormat.format(value);

// The backend always serializes DateTime as UTC ('Z'-suffixed ISO8601) —
// .toLocal() converts to the device's own timezone before formatting.
// Without this, every date/time in the app reads ~1h behind for a user in
// Algeria (UTC+1), which is exactly the bug this fixes: never format a raw
// UTC DateTime directly, always convert first.
String formatDate(DateTime value) => _dateFormat.format(value.toLocal());
