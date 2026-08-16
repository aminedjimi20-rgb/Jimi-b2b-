import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../models/client.dart';
import '../../../models/employee.dart';
import '../../../services/service_providers.dart';

enum _Audience { allClients, allEmployees, allAdmins, everyone, oneClient, oneEmployee }

extension on _Audience {
  String get label => switch (this) {
        _Audience.allClients => 'Tous les clients',
        _Audience.allEmployees => 'Tous les employés',
        _Audience.allAdmins => 'Tous les admins',
        _Audience.everyone => 'Tout le monde',
        _Audience.oneClient => 'Un client précis',
        _Audience.oneEmployee => 'Un employé précis',
      };

  String get apiValue => switch (this) {
        _Audience.allClients => 'ALL_CLIENTS',
        _Audience.allEmployees => 'ALL_EMPLOYEES',
        _Audience.allAdmins => 'ALL_ADMINS',
        _Audience.everyone => 'EVERYONE',
        _Audience.oneClient => 'ONE_CLIENT',
        _Audience.oneEmployee => 'ONE_EMPLOYEE',
      };

  bool get needsTarget => this == _Audience.oneClient || this == _Audience.oneEmployee;
}

final _clientsForBroadcastProvider = FutureProvider.autoDispose<List<ClientView>>((ref) => ref.watch(clientsApiProvider).listAdmin());
final _employeesForBroadcastProvider = FutureProvider.autoDispose<List<EmployeeView>>((ref) => ref.watch(employeesApiProvider).listAdmin());

/// Admin-only — sends a targeted "diffusion" notification: everyone, a
/// whole role, or a single client/employee (see NotificationsService.broadcast
/// on the backend, which is where the audience is actually enforced).
class AdminBroadcastScreen extends ConsumerStatefulWidget {
  const AdminBroadcastScreen({super.key});

  @override
  ConsumerState<AdminBroadcastScreen> createState() => _AdminBroadcastScreenState();
}

class _AdminBroadcastScreenState extends ConsumerState<AdminBroadcastScreen> {
  final _titre = TextEditingController();
  final _message = TextEditingController();
  _Audience _audience = _Audience.everyone;
  ClientView? _targetClient;
  EmployeeView? _targetEmployee;
  bool _sending = false;
  String? _error;

  Future<void> _pickClient() async {
    final clients = await ref.read(_clientsForBroadcastProvider.future);
    if (!mounted) return;
    final selected = await showModalBottomSheet<ClientView>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _PickerSheet<ClientView>(
        title: 'Choisir un client',
        items: clients,
        labelOf: (c) => c.raisonSociale,
        subtitleOf: (c) => c.telephone,
      ),
    );
    if (selected != null) setState(() => _targetClient = selected);
  }

  Future<void> _pickEmployee() async {
    final employees = await ref.read(_employeesForBroadcastProvider.future);
    if (!mounted) return;
    final selected = await showModalBottomSheet<EmployeeView>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _PickerSheet<EmployeeView>(
        title: 'Choisir un employé',
        items: employees,
        labelOf: (e) => e.nom,
        subtitleOf: (e) => e.phone ?? '-',
      ),
    );
    if (selected != null) setState(() => _targetEmployee = selected);
  }

  Future<void> _send() async {
    if (_titre.text.trim().isEmpty || _message.text.trim().isEmpty) {
      setState(() => _error = 'Titre et message requis.');
      return;
    }
    if (_audience.needsTarget && _audience == _Audience.oneClient && _targetClient == null) {
      setState(() => _error = 'Choisissez un client.');
      return;
    }
    if (_audience.needsTarget && _audience == _Audience.oneEmployee && _targetEmployee == null) {
      setState(() => _error = 'Choisissez un employé.');
      return;
    }

    setState(() {
      _sending = true;
      _error = null;
    });

    try {
      final sent = await ref.read(notificationsApiProvider).broadcast(
            titre: _titre.text.trim(),
            message: _message.text.trim(),
            audience: _audience.apiValue,
            targetId: _audience == _Audience.oneClient
                ? _targetClient?.id
                : _audience == _Audience.oneEmployee
                    ? _targetEmployee?.id
                    : null,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Envoyé à $sent destinataire${sent == 1 ? '' : 's'}.')));
        Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Erreur lors de l\'envoi.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  void dispose() {
    _titre.dispose();
    _message.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Diffuser une notification')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextFormField(controller: _titre, decoration: const InputDecoration(labelText: 'Titre')),
          const SizedBox(height: 12),
          TextFormField(controller: _message, decoration: const InputDecoration(labelText: 'Message'), maxLines: 4),
          const SizedBox(height: 20),
          Text('Destinataires', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _Audience.values
                .map((a) => ChoiceChip(label: Text(a.label), selected: _audience == a, onSelected: (_) => setState(() => _audience = a)))
                .toList(),
          ),
          if (_audience == _Audience.oneClient) ...[
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                leading: const Icon(Icons.person_outline),
                title: Text(_targetClient?.raisonSociale ?? 'Choisir un client'),
                trailing: const Icon(Icons.chevron_right),
                onTap: _pickClient,
              ),
            ),
          ],
          if (_audience == _Audience.oneEmployee) ...[
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                leading: const Icon(Icons.badge_outlined),
                title: Text(_targetEmployee?.nom ?? 'Choisir un employé'),
                trailing: const Icon(Icons.chevron_right),
                onTap: _pickEmployee,
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: AppTheme.danger)),
          ],
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _sending ? null : _send,
            icon: _sending
                ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.send_outlined),
            label: const Text('Envoyer'),
          ),
        ],
      ),
    );
  }
}

class _PickerSheet<T> extends StatefulWidget {
  const _PickerSheet({required this.title, required this.items, required this.labelOf, required this.subtitleOf});
  final String title;
  final List<T> items;
  final String Function(T) labelOf;
  final String Function(T) subtitleOf;

  @override
  State<_PickerSheet<T>> createState() => _PickerSheetState<T>();
}

class _PickerSheetState<T> extends State<_PickerSheet<T>> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final filtered = _query.isEmpty ? widget.items : widget.items.where((i) => widget.labelOf(i).toLowerCase().contains(_query)).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(hintText: 'Rechercher...', prefixIcon: Icon(Icons.search)),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: filtered.isEmpty
                  ? const Center(child: Text('Aucun résultat.'))
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: filtered.length,
                      itemBuilder: (context, i) {
                        final item = filtered[i];
                        return ListTile(
                          title: Text(widget.labelOf(item)),
                          subtitle: Text(widget.subtitleOf(item)),
                          onTap: () => Navigator.pop(context, item),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
