import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../services/service_providers.dart';

class AdminClientFormScreen extends ConsumerStatefulWidget {
  const AdminClientFormScreen({super.key});

  @override
  ConsumerState<AdminClientFormScreen> createState() => _AdminClientFormScreenState();
}

class _AdminClientFormScreenState extends ConsumerState<AdminClientFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _raisonSociale = TextEditingController();
  final _telephone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _adresse = TextEditingController();
  final _ville = TextEditingController();
  final _limiteCredit = TextEditingController(text: '0');
  final _notes = TextEditingController();

  bool _saving = false;
  String? _error;

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(clientsApiProvider).create({
        'raisonSociale': _raisonSociale.text.trim(),
        'telephone': _telephone.text.trim(),
        'phone': _telephone.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
        'password': _password.text,
        if (_adresse.text.trim().isNotEmpty) 'adresse': _adresse.text.trim(),
        if (_ville.text.trim().isNotEmpty) 'ville': _ville.text.trim(),
        'limiteCredit': double.tryParse(_limiteCredit.text) ?? 0,
        if (_notes.text.trim().isNotEmpty) 'notesInternes': _notes.text.trim(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Erreur lors de la création.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    for (final c in [_raisonSociale, _telephone, _email, _password, _adresse, _ville, _limiteCredit, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nouveau client')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _raisonSociale,
              decoration: const InputDecoration(labelText: 'Raison sociale / Nom du commerce'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Champ requis' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _telephone,
              decoration: const InputDecoration(labelText: 'Téléphone (identifiant de connexion)'),
              keyboardType: TextInputType.phone,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Champ requis' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(controller: _email, decoration: const InputDecoration(labelText: 'Email (optionnel)')),
            const SizedBox(height: 12),
            TextFormField(
              controller: _password,
              decoration: const InputDecoration(labelText: 'Mot de passe initial'),
              obscureText: true,
              validator: (v) => (v == null || v.length < 6) ? 'Au moins 6 caractères' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(controller: _adresse, decoration: const InputDecoration(labelText: 'Adresse')),
            const SizedBox(height: 12),
            TextFormField(controller: _ville, decoration: const InputDecoration(labelText: 'Ville')),
            const SizedBox(height: 12),
            TextFormField(
              controller: _limiteCredit,
              decoration: const InputDecoration(labelText: 'Limite de crédit'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notes,
              decoration: const InputDecoration(labelText: 'Notes internes (non visibles par le client)'),
              maxLines: 2,
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: const TextStyle(color: AppTheme.danger)),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Créer le compte client'),
            ),
          ],
        ),
      ),
    );
  }
}
