import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../offline/app_database.dart';
import '../providers.dart';

/// Debounced auto-save for a long form (counter sale, product sheet...) —
/// backed by AppDatabase's `form_drafts` table so a killed app or an
/// accidental back-navigation doesn't lose half-filled work. One instance
/// per screen: call [save] on every field change (cheap — it just resets a
/// timer), [load] once on init, and [clear] once the form is actually
/// submitted.
class FormDraftStore {
  FormDraftStore(this._db, this.formKey);

  final AppDatabase _db;
  final String formKey;
  Timer? _debounce;

  Future<Map<String, dynamic>?> load() => _db.readDraft(formKey);

  void save(Map<String, dynamic> data) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), () {
      _db.saveDraft(formKey, data);
    });
  }

  Future<void> clear() {
    _debounce?.cancel();
    return _db.clearDraft(formKey);
  }

  void dispose() => _debounce?.cancel();
}

FormDraftStore createFormDraftStore(WidgetRef ref, String formKey) {
  return FormDraftStore(ref.read(appDatabaseProvider), formKey);
}
