import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/transaction.dart';
import '../services/mock_service.dart';

enum ConfirmState { waiting, success, error }

class ConfirmationScreen extends StatefulWidget {
  final TransactionPreview preview;

  const ConfirmationScreen({super.key, required this.preview});

  @override
  State<ConfirmationScreen> createState() => _ConfirmationScreenState();
}

class _ConfirmationScreenState extends State<ConfirmationScreen>
    with TickerProviderStateMixin {
  ConfirmState _state = ConfirmState.waiting;
  bool _loading = false;

  late AnimationController _cardAnim;
  late AnimationController _resultAnim;
  late Animation<double> _cardFade;
  late Animation<Offset> _cardSlide;
  late Animation<double> _resultScale;

  @override
  void initState() {
    super.initState();

    _cardAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _cardFade =
        Tween<double>(begin: 0, end: 1).animate(_cardAnim);
    _cardSlide = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _cardAnim, curve: Curves.easeOutCubic));

    _resultAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _resultScale = Tween<double>(begin: 0.5, end: 1).animate(
      CurvedAnimation(parent: _resultAnim, curve: Curves.elasticOut),
    );

    _cardAnim.forward();
  }

  @override
  void dispose() {
    _cardAnim.dispose();
    _resultAnim.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    setState(() => _loading = true);

    final ok = await MockService.executeTransaction(widget.preview);
    // Remplacer par: await ApiService.sendMoney(...)

    if (!mounted) return;

    setState(() {
      _loading = false;
      _state = ok ? ConfirmState.success : ConfirmState.error;
    });

    _resultAnim.forward();
  }

  void _cancel() => Navigator.pop(context);

  void _goHome() =>
      Navigator.pushNamedAndRemoveUntil(context, '/home', (_) => false);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: _state == ConfirmState.waiting
          ? AppBar(
              title: const Text('Confirmer'),
              leading: IconButton(
                icon: const Icon(Icons.close_rounded, size: 22),
                onPressed: _cancel,
              ),
            )
          : null,
      body: SafeArea(
        child: _state == ConfirmState.waiting
            ? _buildConfirmView()
            : _buildResultView(),
      ),
    );
  }

  Widget _buildConfirmView() {
    final p = widget.preview;

    return FadeTransition(
      opacity: _cardFade,
      child: SlideTransition(
        position: _cardSlide,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 24),
              _buildSummaryCard(p),
              const SizedBox(height: 28),
              _buildVoiceConfirmBubble(p),
              const Spacer(),
              _buildActions(),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryCard(TransactionPreview p) {
    return Container(
      width: double.infinity,
      decoration: AppShadow.card(),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            // Icône type
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.amberGlow,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Icon(
                  p.type == TransactionType.send
                      ? Icons.arrow_upward_rounded
                      : p.type == TransactionType.recharge
                          ? Icons.bolt_rounded
                          : Icons.receipt_rounded,
                  color: AppColors.amber,
                  size: 30,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              p.description,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppColors.textSecondary,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              '${_formatAmount(p.amount)} ${p.currency}',
              style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    color: AppColors.navy,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            _buildDivider(),
            const SizedBox(height: 20),
            _buildDetailRow('Destinataire', p.recipientName),
            if (p.recipientPhone != null) ...[
              const SizedBox(height: 12),
              _buildDetailRow('Numéro', p.recipientPhone!),
            ],
            const SizedBox(height: 12),
            _buildDetailRow('Frais', '0 ${p.currency}'),
            const SizedBox(height: 12),
            _buildDetailRow(
              'Total débité',
              '${_formatAmount(p.amount)} ${p.currency}',
              highlight: true,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return Row(
      children: [
        Expanded(child: Divider(color: AppColors.surfaceAlt, height: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            'DÉTAILS',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontSize: 10,
                ),
          ),
        ),
        Expanded(child: Divider(color: AppColors.surfaceAlt, height: 1)),
      ],
    );
  }

  Widget _buildDetailRow(String label, String value,
      {bool highlight = false}) {
    return Row(
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const Spacer(),
        Text(
          value,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontSize: 14,
                color: highlight ? AppColors.navy : AppColors.textPrimary,
                fontWeight:
                    highlight ? FontWeight.w700 : FontWeight.w500,
              ),
        ),
      ],
    );
  }

  Widget _buildVoiceConfirmBubble(TransactionPreview p) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.navy.withOpacity(0.05),
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(
          color: AppColors.navy.withOpacity(0.12),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.smart_toy_outlined,
              color: AppColors.navy, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _voiceMessage(p),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.navy,
                    fontStyle: FontStyle.italic,
                  ),
            ),
          ),
        ],
      ),
    );
  }

  String _voiceMessage(TransactionPreview p) {
    switch (p.type) {
      case TransactionType.send:
        return '« Voulez-vous envoyer ${_formatAmount(p.amount)} ${p.currency} à ${p.recipientName} ? »';
      case TransactionType.recharge:
        return '« Voulez-vous recharger ${_formatAmount(p.amount)} ${p.currency} sur ${p.recipientName} ? »';
      case TransactionType.payment:
        return '« Voulez-vous payer ${_formatAmount(p.amount)} ${p.currency} pour ${p.serviceLabel ?? p.recipientName} ? »';
      default:
        return '« Confirmez-vous cette transaction ? »';
    }
  }

  Widget _buildActions() {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          height: 54,
          child: ElevatedButton(
            onPressed: _loading ? null : _confirm,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.amber,
            ),
            child: _loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2.5),
                  )
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.check_circle_outline_rounded, size: 20),
                      SizedBox(width: 8),
                      Text('Confirmer'),
                    ],
                  ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          height: 54,
          child: TextButton(
            onPressed: _loading ? null : _cancel,
            child: Text(
              'Annuler',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildResultView() {
    final isSuccess = _state == ConfirmState.success;

    return Center(
      child: ScaleTransition(
        scale: _resultScale,
        child: FadeTransition(
          opacity: _resultAnim,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isSuccess ? AppColors.successBg : AppColors.errorBg,
                  ),
                  child: Icon(
                    isSuccess
                        ? Icons.check_rounded
                        : Icons.error_outline_rounded,
                    size: 52,
                    color: isSuccess ? AppColors.success : AppColors.error,
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  isSuccess ? 'Transaction réussie !' : 'Transaction échouée',
                  style: Theme.of(context).textTheme.headlineMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  isSuccess
                      ? 'Votre transfert de ${_formatAmount(widget.preview.amount)} ${widget.preview.currency} a bien été effectué.'
                      : 'Une erreur est survenue. Veuillez réessayer.',
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 48),
                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: ElevatedButton(
                    onPressed: _goHome,
                    child: const Text("Retour à l'accueil"),
                  ),
                ),
                const SizedBox(height: 12),
                if (!isSuccess)
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _state = ConfirmState.waiting;
                        _resultAnim.reset();
                      });
                    },
                    child: const Text('Réessayer'),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatAmount(double amount) {
    return amount
        .toStringAsFixed(0)
        .replaceAllMapped(
            RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]} ');
  }
}
