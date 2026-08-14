import 'dart:convert';

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

/// Local SQLite cache: last-seen catalog (for offline browsing), the
/// persisted cart (survives app restarts), and a queue of orders created
/// while offline (flushed by SyncService once connectivity returns). See
/// docs/ARCHITECTURE.md §9 for the offline strategy this implements.
class AppDatabase {
  Database? _db;

  Future<Database> get database async {
    _db ??= await _open();
    return _db!;
  }

  Future<Database> _open() async {
    final path = join(await getDatabasesPath(), 'jimi_b2b.db');
    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE cached_catalog (
            id TEXT PRIMARY KEY,
            json TEXT NOT NULL,
            cachedAt INTEGER NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE cart_items (
            productId TEXT PRIMARY KEY,
            productJson TEXT NOT NULL,
            quantite INTEGER NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE pending_orders (
            id TEXT PRIMARY KEY,
            payloadJson TEXT NOT NULL,
            createdAt INTEGER NOT NULL
          )
        ''');
      },
    );
  }

  // ── Catalog cache ────────────────────────────────────────────────────

  /// Upserts (never wipes) — a filtered search's results shouldn't evict
  /// products cached by a broader fetch made earlier in the session.
  Future<void> cacheCatalog(List<Map<String, dynamic>> products) async {
    final db = await database;
    final batch = db.batch();
    final now = DateTime.now().millisecondsSinceEpoch;
    for (final p in products) {
      batch.insert('cached_catalog', {'id': p['id'], 'json': jsonEncode(p), 'cachedAt': now}, conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<List<Map<String, dynamic>>> readCachedCatalog() async {
    final db = await database;
    final rows = await db.query('cached_catalog');
    return rows.map((r) => jsonDecode(r['json'] as String) as Map<String, dynamic>).toList();
  }

  // ── Cart ─────────────────────────────────────────────────────────────

  Future<void> saveCart(List<({Map<String, dynamic> product, int quantite})> lines) async {
    final db = await database;
    final batch = db.batch();
    batch.delete('cart_items');
    for (final line in lines) {
      batch.insert('cart_items', {
        'productId': line.product['id'],
        'productJson': jsonEncode(line.product),
        'quantite': line.quantite,
      });
    }
    await batch.commit(noResult: true);
  }

  Future<List<({Map<String, dynamic> product, int quantite})>> readCart() async {
    final db = await database;
    final rows = await db.query('cart_items');
    return rows
        .map((r) => (product: jsonDecode(r['productJson'] as String) as Map<String, dynamic>, quantite: r['quantite'] as int))
        .toList();
  }

  // ── Pending (offline) orders ─────────────────────────────────────────

  Future<void> queuePendingOrder(String localId, Map<String, dynamic> payload) async {
    final db = await database;
    await db.insert('pending_orders', {
      'id': localId,
      'payloadJson': jsonEncode(payload),
      'createdAt': DateTime.now().millisecondsSinceEpoch,
    });
  }

  Future<List<({String id, Map<String, dynamic> payload, DateTime createdAt})>> readPendingOrders() async {
    final db = await database;
    final rows = await db.query('pending_orders', orderBy: 'createdAt ASC');
    return rows
        .map((r) => (
              id: r['id'] as String,
              payload: jsonDecode(r['payloadJson'] as String) as Map<String, dynamic>,
              createdAt: DateTime.fromMillisecondsSinceEpoch(r['createdAt'] as int),
            ))
        .toList();
  }

  Future<void> removePendingOrder(String localId) async {
    final db = await database;
    await db.delete('pending_orders', where: 'id = ?', whereArgs: [localId]);
  }
}
