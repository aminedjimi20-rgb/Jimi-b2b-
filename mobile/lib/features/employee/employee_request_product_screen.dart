import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../services/service_providers.dart';

/// Same idea as the Client's "Demander un produit" — an Employee sends a
/// photo of a product that isn't in the catalog yet, the Admin reviews it
/// from AdminProductRequestsScreen (both flows share the same backend
/// module, just filed under employeeId instead of clientId).
class EmployeeRequestProductScreen extends ConsumerStatefulWidget {
  const EmployeeRequestProductScreen({super.key, this.initialImagePath});
  final String? initialImagePath;

  @override
  ConsumerState<EmployeeRequestProductScreen> createState() => _EmployeeRequestProductScreenState();
}

class _EmployeeRequestProductScreenState extends ConsumerState<EmployeeRequestProductScreen> {
  String? _pickedPath;
  final _description = TextEditingController();
  bool _sending = false;
  String? _error;
  bool _sent = false;

  @override
  void initState() {
    super.initState();
    _pickedPath = widget.initialImagePath;
  }

  Future<void> _pick(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 85, maxWidth: 1200);
    if (picked == null) return;
    setState(() => _pickedPath = picked.path);
  }

  Future<void> _submit() async {
    if (_pickedPath == null) {
      setState(() => _error = 'Ajoutez une photo du produit recherché.');
      return;
    }

    setState(() {
      _sending = true;
      _error = null;
    });

    try {
      final imageUrl = await ref.read(uploadsApiProvider).uploadRequestPhoto(_pickedPath!);
      await ref.read(productRequestsApiProvider).createForEmployee(
            imageUrl: imageUrl,
            description: _description.text.trim().isEmpty ? null : _description.text.trim(),
          );
      if (mounted) setState(() => _sent = true);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Erreur lors de l\'envoi.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_sent) {
      return Scaffold(
        appBar: AppBar(title: const Text('Demande envoyée')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle_outline, color: AppTheme.success, size: 56),
                const SizedBox(height: 16),
                const Text('Votre demande a été envoyée à l\'Admin.', textAlign: TextAlign.center),
                const SizedBox(height: 24),
                ElevatedButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Terminer')),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Demander un produit')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Ce produit n\'existe pas dans la base ? Envoyez-en une photo, l\'Admin la traitera.'),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pick(ImageSource.camera),
                  icon: const Icon(Icons.photo_camera_outlined),
                  label: const Text('Caméra'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pick(ImageSource.gallery),
                  icon: const Icon(Icons.photo_library_outlined),
                  label: const Text('Galerie'),
                ),
              ),
            ],
          ),
          if (_pickedPath != null) ...[
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.file(File(_pickedPath!), height: 200, width: double.infinity, fit: BoxFit.cover),
            ),
          ],
          const SizedBox(height: 16),
          TextField(
            controller: _description,
            decoration: const InputDecoration(labelText: 'Description (optionnel)', hintText: 'Marque, taille, couleur...'),
            maxLines: 3,
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: AppTheme.danger)),
          ],
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _sending ? null : _submit,
            icon: _sending
                ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.send_outlined),
            label: const Text('Envoyer la demande'),
          ),
        ],
      ),
    );
  }
}
