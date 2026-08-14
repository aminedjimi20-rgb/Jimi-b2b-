import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/providers.dart';

class AdminExportScreen extends ConsumerStatefulWidget {
  const AdminExportScreen({super.key});

  @override
  ConsumerState<AdminExportScreen> createState() => _AdminExportScreenState();
}

class _AdminExportScreenState extends ConsumerState<AdminExportScreen> {
  String? _downloading;

  Future<void> _export(String endpoint, String filename) async {
    setState(() => _downloading = endpoint);
    try {
      final dio = ref.read(dioProvider);
      final response = await dio.get<List<int>>(endpoint, options: Options(responseType: ResponseType.bytes));
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/$filename');
      await file.writeAsBytes(response.data!);
      await Share.shareXFiles([XFile(file.path)], text: 'Export JIMI B2B — $filename');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e is ApiException ? e.message : 'Erreur export.')));
      }
    } finally {
      if (mounted) setState(() => _downloading = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Export de données')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _ExportTile(
            title: 'Produits',
            subtitle: 'Catalogue complet avec prix et marges',
            loading: _downloading == '/export/products',
            onTap: () => _export('/export/products', 'produits.xlsx'),
          ),
          _ExportTile(
            title: 'Commandes',
            subtitle: 'Historique des commandes',
            loading: _downloading == '/export/orders',
            onTap: () => _export('/export/orders', 'commandes.xlsx'),
          ),
          _ExportTile(
            title: 'Clients',
            subtitle: 'Liste des clients et soldes crédit',
            loading: _downloading == '/export/clients',
            onTap: () => _export('/export/clients', 'clients.xlsx'),
          ),
        ],
      ),
    );
  }
}

class _ExportTile extends StatelessWidget {
  const _ExportTile({required this.title, required this.subtitle, required this.loading, required this.onTap});
  final String title;
  final String subtitle;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.table_chart_outlined),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: loading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.ios_share),
        onTap: loading ? null : onTap,
      ),
    );
  }
}
