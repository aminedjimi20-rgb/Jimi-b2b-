import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/drafts/form_draft_store.dart';
import '../../../core/offline/connectivity_provider.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/draft_resume_banner.dart';
import '../../../models/order.dart';
import '../../../services/orders_api.dart';
import '../../../services/service_providers.dart';
import '../orders/client_order_detail_screen.dart';
import 'cart_controller.dart';
import 'offline_order_queued_screen.dart';

const _draftFormKey = 'client_checkout';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _formKey = GlobalKey<FormState>();
  final _adresse = TextEditingController();
  final _telephone = TextEditingController();
  final _notes = TextEditingController();
  String _paymentMethod = 'ESPECES';
  bool _submitting = false;
  String? _error;

  late final FormDraftStore _draftStore = createFormDraftStore(ref, _draftFormKey);
  bool _draftChecked = false;
  Map<String, dynamic>? _pendingDraft;

  @override
  void initState() {
    super.initState();
    _loadDraft();
  }

  Future<void> _loadDraft() async {
    final draft = await _draftStore.load();
    if (!mounted) return;
    setState(() {
      _pendingDraft = draft;
      _draftChecked = true;
    });
  }

  Map<String, dynamic> _currentDraftData() => {
        'adresseLivraison': _adresse.text,
        'telephoneContact': _telephone.text,
        'notes': _notes.text,
        'paymentMethod': _paymentMethod,
      };

  void _resumeDraft(Map<String, dynamic> data) {
    setState(() {
      _adresse.text = data['adresseLivraison'] as String? ?? '';
      _telephone.text = data['telephoneContact'] as String? ?? '';
      _notes.text = data['notes'] as String? ?? '';
      _paymentMethod = data['paymentMethod'] as String? ?? _paymentMethod;
      _pendingDraft = null;
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final cart = ref.read(cartControllerProvider);
    if (cart.isEmpty) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    final payload = {
      'items': cart.map((l) => {'productId': l.product.id, 'quantite': l.quantite}).toList(),
      'paymentMethod': _paymentMethod,
      'adresseLivraison': _adresse.text.trim(),
      'telephoneContact': _telephone.text.trim(),
      if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
    };

    final online = await isCurrentlyOnline();
    if (!online) {
      await _queueOffline(payload);
      return;
    }

    try {
      final order = await ref.read(ordersApiProvider).create(
            items: cart.map((l) => OrderItemInput(productId: l.product.id, quantite: l.quantite)).toList(),
            paymentMethod: _paymentMethod,
            adresseLivraison: _adresse.text.trim(),
            telephoneContact: _telephone.text.trim(),
            notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
          );
      ref.read(cartControllerProvider.notifier).clear();
      await _draftStore.clear();
      if (mounted) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => ClientOrderDetailScreen(orderId: order.id)));
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      // Not a clean API error (e.g. connection dropped mid-request even
      // though the device reported "online") — don't lose the order, queue it.
      await _queueOffline(payload);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _queueOffline(Map<String, dynamic> payload) async {
    await ref.read(appDatabaseProvider).queuePendingOrder(const Uuid().v4(), payload);
    ref.read(cartControllerProvider.notifier).clear();
    await _draftStore.clear();
    if (mounted) {
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const OfflineOrderQueuedScreen()));
    }
  }

  @override
  void dispose() {
    _adresse.dispose();
    _telephone.dispose();
    _notes.dispose();
    _draftStore.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartControllerProvider);
    final total = cart.fold<double>(0, (sum, l) => sum + l.sousTotal);

    if (_draftChecked && _pendingDraft == null) {
      _draftStore.save(_currentDraftData());
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Finaliser la commande')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_pendingDraft != null)
              DraftResumeBanner(
                onResume: () => _resumeDraft(_pendingDraft!),
                onDismiss: () {
                  _draftStore.clear();
                  setState(() => _pendingDraft = null);
                },
              ),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Récapitulatif (${cart.length} article(s))', style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    ...cart.map((l) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Row(
                            children: [
                              Expanded(child: Text('${l.quantite} × ${l.product.nom}')),
                              Text(formatMoney(l.sousTotal)),
                            ],
                          ),
                        )),
                    const Divider(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total', style: TextStyle(fontWeight: FontWeight.bold)),
                        Text(formatMoney(total), style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            TextFormField(
              controller: _adresse,
              decoration: const InputDecoration(labelText: 'Adresse de livraison'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Champ requis' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _telephone,
              decoration: const InputDecoration(labelText: 'Téléphone de contact'),
              keyboardType: TextInputType.phone,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Champ requis' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(controller: _notes, decoration: const InputDecoration(labelText: 'Notes (optionnel)'), maxLines: 2),
            const SizedBox(height: 20),
            Text('Méthode de paiement', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...kPaymentMethods.map((m) => RadioListTile<String>(
                  contentPadding: EdgeInsets.zero,
                  value: m,
                  groupValue: _paymentMethod,
                  title: Text(paymentMethodLabel(m)),
                  onChanged: (v) => setState(() => _paymentMethod = v!),
                )),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: AppTheme.danger)),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Confirmer la commande'),
            ),
          ],
        ),
      ),
    );
  }
}
