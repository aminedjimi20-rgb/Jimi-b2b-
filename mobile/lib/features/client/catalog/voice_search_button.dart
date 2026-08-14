import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

import '../../../core/theme/app_theme.dart';

/// Microphone button for voice search — speech is transcribed entirely
/// on-device (speech_to_text), then handed to the caller as plain text to
/// feed into the normal catalog text search (see docs/ARCHITECTURE.md §8).
/// No audio ever leaves the device.
class VoiceSearchButton extends StatefulWidget {
  const VoiceSearchButton({super.key, required this.onResult});

  final void Function(String text) onResult;

  @override
  State<VoiceSearchButton> createState() => _VoiceSearchButtonState();
}

class _VoiceSearchButtonState extends State<VoiceSearchButton> {
  final _speech = stt.SpeechToText();
  bool _listening = false;
  bool _available = true;

  Future<void> _toggleListening() async {
    if (_listening) {
      await _speech.stop();
      setState(() => _listening = false);
      return;
    }

    final available = await _speech.initialize(onStatus: (status) {
      if (status == 'done' || status == 'notListening') {
        if (mounted) setState(() => _listening = false);
      }
    });

    if (!available) {
      setState(() => _available = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reconnaissance vocale indisponible sur cet appareil.')),
        );
      }
      return;
    }

    setState(() => _listening = true);
    await _speech.listen(
      onResult: (result) {
        if (result.finalResult) {
          widget.onResult(result.recognizedWords);
          setState(() => _listening = false);
        }
      },
      listenOptions: stt.SpeechListenOptions(localeId: 'fr_FR'),
    );
  }

  @override
  void dispose() {
    _speech.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_available) return const SizedBox.shrink();
    return IconButton(
      icon: Icon(_listening ? Icons.mic : Icons.mic_none, color: _listening ? AppTheme.accent : Colors.white70),
      tooltip: 'Recherche vocale',
      onPressed: _toggleListening,
    );
  }
}
