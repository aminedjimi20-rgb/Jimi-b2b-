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
      version: 2,
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
        await db.execute(_formDraftsTable);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await db.execute(_formDraftsTable);
        }
      },
    );
  }

  static const _formDraftsTable = '''
    CREATE TABLE form_drafts (
      formKey TEXT PRIMARY KEY,
      dataJson TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  ''';

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

  // ── Form drafts ──────────────────────────────────────────────────────
  //
  // Auto-saved as the user fills a long form (counter sale, product sheet,
  // stock receipt...) so an accidental navigation/app-kill doesn't lose the
  // work — restored (with confirmation) next time that same form opens,
  // and cleared once the form is actually submitted. `formKey` scopes
  // drafts per form kind, same as `cart_items`/`pending_orders` above —
  // this table isn't user-scoped either, consistent with the rest of this
  // local cache (not cleared on logout).

  Future<void> saveDraft(String formKey, Map<String, dynamic> data) async {
    final db = await database;
    await db.insert(
      'form_drafts',
      {'formKey': formKey, 'dataJson': jsonEncode(data), 'updatedAt': DateTime.now().millisecondsSinceEpoch},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<Map<String, dynamic>?> readDraft(String formKey) async {
    final db = await database;
    final rows = await db.query('form_drafts', where: 'formKey = ?', whereArgs: [formKey], limit: 1);
    if (rows.isEmpty) return null;
    return jsonDecode(rows.first['dataJson'] as String) as Map<String, dynamic>;
  }

  Future<void> clearDraft(String formKey) async {
    final db = await database;
    await db.delete('form_drafts', where: 'formKey = ?', whereArgs: [formKey]);
  }

  /// Every pending draft across all form kinds — powers the global
  /// "Brouillons" list so a half-filled bon is visible without reopening
  /// its creation screen.
  Future<List<({String formKey, DateTime updatedAt})>> readAllDrafts() async {
    final db = await database;
    final rows = await db.query('form_drafts', orderBy: 'updatedAt DESC');
    return rows.map((r) => (formKey: r['formKey'] as String, updatedAt: DateTime.fromMillisecondsSinceEpoch(r['updatedAt'] as int))).toList();
  }

  /// Every draft under a "family" of keys (e.g. `admin_stock_receipt_form:`
  /// + a per-bon uuid) — a screen that can have several unrelated
  /// in-progress bons at once (start one, get interrupted, start another)
  /// uses a unique key per bon instead of one fixed key, so this is how a
  /// list screen finds "all of them" to show as separate brouillon cards.
  Future<List<({String formKey, Map<String, dynamic> data, DateTime updatedAt})>> readDraftsByPrefix(String prefix) async {
    final db = await database;
    final rows = await db.query('form_drafts', where: 'formKey LIKE ?', whereArgs: ['$prefix%'], orderBy: 'updatedAt DESC');
    return rows
        .map((r) => (
              formKey: r['formKey'] as String,
              data: jsonDecode(r['dataJson'] as String) as Map<String, dynamic>,
              updatedAt: DateTime.fromMillisecondsSinceEpoch(r['updatedAt'] as int),
            ))
        .toList();
  }
}
