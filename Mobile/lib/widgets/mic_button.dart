import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'dart:math' as math;

/// États du bouton micro
enum MicState { idle, listening, processing, error }

class MicButton extends StatefulWidget {
  final MicState state;
  final VoidCallback onTap;
  final double size;

  const MicButton({
    super.key,
    required this.state,
    required this.onTap,
    this.size = 80,
  });

  @override
  State<MicButton> createState() => _MicButtonState();
}

class _MicButtonState extends State<MicButton>
    with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _rippleController;
  late AnimationController _rotateController;

  @override
  void initState() {
    super.initState();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _rippleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    );

    _rotateController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat();

    _updateState(widget.state);
  }

  @override
  void didUpdateWidget(MicButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.state != widget.state) {
      _updateState(widget.state);
    }
  }

  void _updateState(MicState state) {
    switch (state) {
      case MicState.idle:
        _pulseController.stop();
        _rippleController.stop();
        _rotateController.stop();
        break;
      case MicState.listening:
        _pulseController.repeat(reverse: true);
        _rippleController.repeat();
        _rotateController.stop();
        break;
      case MicState.processing:
        _pulseController.stop();
        _rippleController.stop();
        _rotateController.repeat();
        break;
      case MicState.error:
        _pulseController.stop();
        _rippleController.stop();
        _rotateController.stop();
        break;
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _rippleController.dispose();
    _rotateController.dispose();
    super.dispose();
  }

  Color get _buttonColor {
    switch (widget.state) {
      case MicState.idle:
        return AppColors.navy;
      case MicState.listening:
        return AppColors.amber;
      case MicState.processing:
        return AppColors.navyLight;
      case MicState.error:
        return AppColors.error;
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;

    return GestureDetector(
      onTap: widget.onTap,
      child: SizedBox(
        width: size * 2,
        height: size * 2,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Ripple
            if (widget.state == MicState.listening)
              ..._buildRipples(size),

            // Fond pulsant
            if (widget.state == MicState.listening)
              AnimatedBuilder(
                animation: _pulseController,
                builder: (_, __) => Container(
                  width: size + 24 * _pulseController.value,
                  height: size + 24 * _pulseController.value,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.amber.withOpacity(
                        0.15 * (1 - _pulseController.value * 0.5)),
                  ),
                ),
              ),

            // Processing spinner
            if (widget.state == MicState.processing)
              AnimatedBuilder(
                animation: _rotateController,
                builder: (_, child) => Transform.rotate(
                  angle: _rotateController.value * 2 * math.pi,
                  child: child,
                ),
                child: Container(
                  width: size + 10,
                  height: size + 10,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.navyLight,
                      width: 3,
                    ),
                  ),
                  child: const Align(
                    alignment: Alignment(0.95, 0),
                    child: CircleAvatar(
                      radius: 4,
                      backgroundColor: AppColors.navyLight,
                    ),
                  ),
                ),
              ),

            // Bouton principal
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOutCubic,
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _buttonColor,
                boxShadow: [
                  BoxShadow(
                    color: _buttonColor.withOpacity(0.35),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Center(
                child: widget.state == MicState.processing
                    ? const SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2.5,
                        ),
                      )
                    : Icon(
                        widget.state == MicState.listening
                            ? Icons.mic_rounded
                            : Icons.mic_none_rounded,
                        color: Colors.white,
                        size: size * 0.4,
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildRipples(double size) {
    return List.generate(3, (i) {
      return AnimatedBuilder(
        animation: _rippleController,
        builder: (_, __) {
          final progress =
              (_rippleController.value + i / 3) % 1.0;
          return Opacity(
            opacity: (1 - progress) * 0.3,
            child: Container(
              width: size + progress * size * 0.9,
              height: size + progress * size * 0.9,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppColors.amber,
                  width: 1.5,
                ),
              ),
            ),
          );
        },
      );
    });
  }
}

/// ── Affichage de la transcription vocale ──────────────────────
class VoiceTranscriptBubble extends StatelessWidget {
  final String text;
  final bool isVisible;

  const VoiceTranscriptBubble({
    super.key,
    required this.text,
    this.isVisible = true,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      opacity: isVisible && text.isNotEmpty ? 1 : 0,
      duration: const Duration(milliseconds: 300),
      child: AnimatedSlide(
        offset: isVisible && text.isNotEmpty
            ? Offset.zero
            : const Offset(0, 0.3),
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 20),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.xl),
            boxShadow: [
              BoxShadow(
                color: AppColors.shadowMedium,
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              const Icon(Icons.record_voice_over_rounded,
                  color: AppColors.amber, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  text.isEmpty ? '...' : text,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.textPrimary,
                        fontStyle: text.isEmpty
                            ? FontStyle.italic
                            : FontStyle.normal,
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
