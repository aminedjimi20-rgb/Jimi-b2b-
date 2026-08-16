import 'package:flutter/material.dart';

/// JIMI B2B visual identity — a confident, business-forward palette
/// (deep indigo primary, warm amber accent for calls to action like
/// "Ajouter au panier" / "Confirmer") kept consistent across both the
/// Admin and Client experiences so the app reads as one product.
class AppTheme {
  static const Color primary = Color(0xFF1E3A5F);
  static const Color accent = Color(0xFFE8A33D);
  static const Color success = Color(0xFF2E9E5B);
  static const Color danger = Color(0xFFD64545);
  static const Color warning = Color(0xFFDB8A1F);

  // Secondary text / placeholders — deliberately darker than Material's
  // default derived greys (which can render as low-contrast light grey on
  // white). ~9:1 contrast on white, comfortably above WCAG AA.
  static const Color textSecondary = Color(0xFF475467);
  static const Color textPlaceholder = Color(0xFF667085);

  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: primary, primary: primary, secondary: accent),
      fontFamily: 'Roboto',
    );

    return base.copyWith(
      scaffoldBackgroundColor: const Color(0xFFF7F8FA),
      appBarTheme: const AppBarTheme(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: const TextStyle(color: textSecondary),
        floatingLabelStyle: const TextStyle(color: primary),
        hintStyle: const TextStyle(color: textPlaceholder),
        helperStyle: const TextStyle(color: textSecondary),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        selectedItemColor: primary,
        unselectedItemColor: textSecondary,
        showUnselectedLabels: true,
      ),
      navigationBarTheme: NavigationBarThemeData(
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? primary : textSecondary,
          ),
        ),
      ),
      textTheme: base.textTheme.copyWith(
        bodySmall: base.textTheme.bodySmall?.copyWith(color: textSecondary),
        bodyMedium: base.textTheme.bodyMedium?.copyWith(color: const Color(0xFF1D2939)),
      ),
    );
  }
}

/// Availability/status colors used across the Client catalog — mirrors the
/// backend's derived stock status, never the raw quantity.
Color stockStatusColor(String status) {
  switch (status) {
    case 'DISPONIBLE':
      return AppTheme.success;
    case 'STOCK_LIMITE':
      return AppTheme.warning;
    case 'RUPTURE':
    default:
      return AppTheme.danger;
  }
}

String stockStatusLabel(String status) {
  switch (status) {
    case 'DISPONIBLE':
      return 'Disponible';
    case 'STOCK_LIMITE':
      return 'Stock limité';
    case 'RUPTURE':
    default:
      return 'Rupture';
  }
}
