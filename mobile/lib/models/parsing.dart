/// Prisma Decimal fields are serialized as JSON strings by the backend
/// (arbitrary precision, no float rounding) — every model parses them
/// through this helper instead of `as double` to stay correct if the
/// server ever also returns a plain number.
double parseDecimal(dynamic value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  return double.parse(value.toString());
}

DateTime? parseDateOrNull(dynamic value) => value == null ? null : DateTime.parse(value as String);
