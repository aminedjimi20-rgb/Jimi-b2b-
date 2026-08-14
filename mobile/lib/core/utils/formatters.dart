import 'package:intl/intl.dart';

final _currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'DA', decimalDigits: 2);
final _dateFormat = DateFormat('dd/MM/yyyy HH:mm', 'fr_FR');

String formatMoney(double value) => _currencyFormat.format(value);
String formatDate(DateTime value) => _dateFormat.format(value);
