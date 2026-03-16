import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/mock_service.dart';

class PinScreen extends StatefulWidget {
  final String phoneNumber;
  const PinScreen({super.key, required this.phoneNumber});

  @override
  State<PinScreen> createState() => _PinScreenState();
}

class _PinScreenState extends State<PinScreen>
    with SingleTickerProviderStateMixin {
  String _pin = '';
  bool _loading = false;
  String? _error;

  late AnimationController _shakeController;
  late Animation<double> _shakeAnim;

  static const int _pinLength = 4;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _shakeAnim = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _shakeController, curve: Curves.elasticIn),
    );
  }

  @override
  void dispose() {
    _shakeController.dispose();
    super.dispose();
  }

  void _addDigit(String digit) {
    if (_pin.length >= _pinLength || _loading) return;
    setState(() {
      _pin += digit;
      _error = null;
    });
    if (_pin.length == _pinLength) {
      _verify();
    }
  }

  void _delete() {
    if (_pin.isEmpty || _loading) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _verify() async {
    setState(() => _loading = true);

    final ok = await MockService.verifyPin(_pin);
    // Remplacer par: await ApiService.login(phoneNumber: widget.phoneNumber, pin: _pin)

    if (!mounted) return;

    if (ok) {
      Navigator.pushNamedAndRemoveUntil(context, '/home', (_) => false);
    } else {
      await _shakeController.forward(from: 0);
      setState(() {
        _loading = false;
        _pin = '';
        _error = 'PIN incorrect. Réessayez.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            children: [
              const SizedBox(height: 40),
              _buildHeader(),
              const SizedBox(height: 48),
              _buildDots(),
              if (_error != null) ...[
                const SizedBox(height: 16),
                _buildError(),
              ],
              const Spacer(),
              _buildKeypad(),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: AppColors.navyDark,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.lock_outline_rounded,
              color: Colors.white, size: 28),
        ),
        const SizedBox(height: 20),
        Text(
          'Entrez votre PIN',
          style: Theme.of(context).textTheme.headlineMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          widget.phoneNumber,
          style: Theme.of(context).textTheme.bodyMedium,
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildDots() {
    return AnimatedBuilder(
      animation: _shakeAnim,
      builder: (_, child) {
        final dx = _shakeAnim.value == 0
            ? 0.0
            : ((_shakeAnim.value * 10) % 2 == 0 ? 1 : -1) *
                8 *
                (1 - _shakeAnim.value);
        return Transform.translate(offset: Offset(dx, 0), child: child);
      },
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(_pinLength, (i) {
          final filled = i < _pin.length;
          return AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            margin: const EdgeInsets.symmetric(horizontal: 10),
            width: filled ? 18 : 14,
            height: filled ? 18 : 14,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: filled ? AppColors.navy : Colors.transparent,
              border: Border.all(
                color: filled ? AppColors.navy : AppColors.textHint,
                width: 2,
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildError() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.errorBg,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline_rounded,
              color: AppColors.error, size: 16),
          const SizedBox(width: 8),
          Text(
            _error!,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: AppColors.error),
          ),
        ],
      ),
    );
  }

  Widget _buildKeypad() {
    final keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'del'],
    ];

    return Column(
      children: keys.map((row) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: row.map((k) => _buildKey(k)).toList(),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildKey(String key) {
    if (key.isEmpty) {
      return const SizedBox(width: 72, height: 72);
    }

    final isDel = key == 'del';

    return GestureDetector(
      onTap: isDel ? _delete : () => _addDigit(key),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          color: AppColors.surface,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: AppColors.shadowMedium,
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Center(
          child: isDel
              ? const Icon(Icons.backspace_outlined,
                  color: AppColors.textSecondary, size: 20)
              : Text(
                  key,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                ),
        ),
      ),
    );
  }
}
