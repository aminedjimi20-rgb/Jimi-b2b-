import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Full-screen, pinch-to-zoom photo viewer — used from every place a product
/// photo is shown (list, fiche produit, panier, bon fournisseur, bon client)
/// so a small thumbnail can always be opened up to see the article clearly.
class PhotoGalleryViewer extends StatefulWidget {
  const PhotoGalleryViewer({super.key, required this.urls, this.initialIndex = 0});

  final List<String> urls;
  final int initialIndex;

  static void open(BuildContext context, List<String> urls, {int initialIndex = 0}) {
    if (urls.isEmpty) return;
    Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black,
        pageBuilder: (_, __, ___) => PhotoGalleryViewer(urls: urls, initialIndex: initialIndex),
      ),
    );
  }

  @override
  State<PhotoGalleryViewer> createState() => _PhotoGalleryViewerState();
}

class _PhotoGalleryViewerState extends State<PhotoGalleryViewer> {
  late final PageController _controller = PageController(initialPage: widget.initialIndex);
  late int _index = widget.initialIndex;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
        title: widget.urls.length > 1 ? Text('${_index + 1} / ${widget.urls.length}') : null,
      ),
      extendBodyBehindAppBar: true,
      body: PageView.builder(
        controller: _controller,
        itemCount: widget.urls.length,
        onPageChanged: (i) => setState(() => _index = i),
        itemBuilder: (context, i) => InteractiveViewer(
          minScale: 1,
          maxScale: 4,
          child: Center(
            child: CachedNetworkImage(
              imageUrl: widget.urls[i],
              fit: BoxFit.contain,
              errorWidget: (_, __, ___) => const Icon(Icons.broken_image_outlined, color: Colors.white54, size: 64),
              placeholder: (_, __) => const CircularProgressIndicator(color: Colors.white54),
            ),
          ),
        ),
      ),
    );
  }
}
