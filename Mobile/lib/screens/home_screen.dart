// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/transaction.dart';
import '../services/mock_service.dart';
import '../widgets/mic_button.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  MicState _micState = MicState.idle;
  String _transcript = '';
  bool _balanceVisible = true;
  double _balance = 0;
  String _userName = '';
  bool _loadingData = true;

  late AnimationController _headerAnim;
  late Animation<double> _headerFade;
  late Animation<Offset> _headerSlide;

  @override
  void initState() {
    super.initState();
    _headerAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _headerFade =
        Tween<double>(begin: 0, end: 1).animate(_headerAnim);
    _headerSlide = Tween<Offset>(
      begin: const Offset(0, -0.04),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _headerAnim, curve: Curves.easeOutCubic));

    _loadData();
  }

  Future<void> _loadData() async {
    final user = await MockService.fetchUser();
    if (!mounted) return;
    setState(() {
      _balance = user.balance;
      _userName = user.firstName;
      _loadingData = false;
    });
    _headerAnim.forward();
  }

  @override
  void dispose() {
    _headerAnim.dispose();
    super.dispose();
  }

  // ── Simulation commande vocale ────────────────────────
  void _onMicTap() {
    if (_micState == MicState.listening) {
      _stopListening();
    } else if (_micState == MicState.idle) {
      _startListening();
    }
  }

  void _startListening() {
    setState(() {
      _micState = MicState.listening;
      _transcript = '';
    });
    // TODO: intégrer speech_to_text plugin
    // _speechToText.listen(onResult: _onSpeechResult);
    _simulateVoiceCommand();
  }

  /// Simulation pour la démo — remplacer par speech_to_text
  Future<void> _simulateVoiceCommand() async {
    final commands = [
      'Envoie 5000 francs à Maman',
      'Quel est mon solde ?',
      'Recharge 2000 francs',
    ];
    final cmd = commands[DateTime.now().second % commands.length];

    await Future.delayed(const Duration(milliseconds: 400));
    if (!mounted || _micState != MicState.listening) return;
    setState(() => _transcript = cmd);

    await Future.delayed(const Duration(milliseconds: 1200));
    if (!mounted || _micState != MicState.listening) return;
    _processCommand(cmd);
  }

  void _stopListening() {
    setState(() {
      _micState = MicState.idle;
      _transcript = '';
    });
  }

  Future<void> _processCommand(String text) async {
    setState(() => _micState = MicState.processing);
    await Future.delayed(const Duration(milliseconds: 800));
    if (!mounted) return;

    setState(() => _micState = MicState.idle);

    if (text.toLowerCase().contains('solde')) {
      _showBalanceSnack();
      return;
    }

    // Parser simple (remplacer par ApiService.processVoiceCommand)
    final preview = _parseCommand(text);
    if (preview != null) {
      Navigator.pushNamed(context, '/confirmation', arguments: preview);
    }
  }

  TransactionPreview? _parseCommand(String text) {
    final lower = text.toLowerCase();
    // Envoyer de l'argent
    if (lower.contains('envoie') || lower.contains('envoyer')) {
      final amount = _extractAmount(text);
      final recipient = _extractRecipient(text);
      return TransactionPreview(
        type: TransactionType.send,
        amount: amount ?? 5000,
        recipientName: recipient ?? 'Maman',
        recipientPhone: '+229 97 00 33 44',
      );
    }
    // Recharge
    if (lower.contains('recharge')) {
      final amount = _extractAmount(text);
      return TransactionPreview(
        type: TransactionType.recharge,
        amount: amount ?? 2000,
        recipientName: 'Mon numéro',
        recipientPhone: '+229 96 00 11 22',
      );
    }
    return null;
  }

  double? _extractAmount(String text) {
    final match = RegExp(r'(\d+)\s*(?:francs?|fcfa|f)?').firstMatch(text);
    if (match != null) return double.tryParse(match.group(1)!);
    return null;
  }

  String? _extractRecipient(String text) {
    final contacts = {'maman': 'Maman', 'papa': 'Papa', 'jean': 'Jean', 'sœur': 'Sœur'};
    for (final entry in contacts.entries) {
      if (text.toLowerCase().contains(entry.key)) return entry.value;
    }
    return null;
  }

  void _showBalanceSnack() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.account_balance_wallet_rounded,
                color: Colors.white, size: 18),
            const SizedBox(width: 10),
            Text('Votre solde est de ${_formatBalance(_balance)} FCFA'),
          ],
        ),
        backgroundColor: AppColors.navy,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md)),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  String _formatBalance(double amount) {
    return amount
        .toStringAsFixed(0)
        .replaceAllMapped(
            RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]} ');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Column(
                  children: [
                    const SizedBox(height: 8),
                    _buildBalanceCard(),
                    const SizedBox(height: 28),
                    _buildMicSection(),
                    const SizedBox(height: 28),
                    _buildQuickActions(),
                    const SizedBox(height: 28),
                    _buildRecentTransactions(),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return FadeTransition(
      opacity: _headerFade,
      child: SlideTransition(
        position: _headerSlide,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
          child: Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _loadingData ? 'Chargement...' : 'Bonjour, $_userName 👋',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Que puis-je faire pour vous ?',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => Navigator.pushNamed(context, '/notifications'),
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: const BoxDecoration(
                    color: AppColors.surface,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.shadowMedium,
                        blurRadius: 8,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.notifications_none_rounded,
                      color: AppColors.textSecondary, size: 20),
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: () => Navigator.pushNamed(context, '/settings'),
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: const BoxDecoration(
                    color: AppColors.surface,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.shadowMedium,
                        blurRadius: 8,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.person_outline_rounded,
                      color: AppColors.textSecondary, size: 20),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBalanceCard() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppColors.navy, AppColors.navyLight],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(AppRadius.xxl),
          boxShadow: [
            BoxShadow(
              color: AppColors.navy.withOpacity(0.3),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  'Solde disponible',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.white60,
                      ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () =>
                      setState(() => _balanceVisible = !_balanceVisible),
                  child: Icon(
                    _balanceVisible
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    color: Colors.white54,
                    size: 20,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _loadingData
                ? Container(
                    height: 38,
                    width: 180,
                    decoration: BoxDecoration(
                      color: Colors.white12,
                      borderRadius: BorderRadius.circular(8),
                    ),
                  )
                : AnimatedCrossFade(
                    duration: const Duration(milliseconds: 200),
                    crossFadeState: _balanceVisible
                        ? CrossFadeState.showFirst
                        : CrossFadeState.showSecond,
                    firstChild: Text(
                      '${_formatBalance(_balance)} FCFA',
                      style: Theme.of(context)
                          .textTheme
                          .displayMedium
                          ?.copyWith(color: Colors.white),
                    ),
                    secondChild: Text(
                      '•••••• FCFA',
                      style: Theme.of(context)
                          .textTheme
                          .displayMedium
                          ?.copyWith(color: Colors.white),
                    ),
                  ),
            const SizedBox(height: 20),
            Row(
              children: [
                _buildCardAction(
                  icon: Icons.arrow_upward_rounded,
                  label: 'Envoyer',
                  onTap: () {},
                ),
                const SizedBox(width: 12),
                _buildCardAction(
                  icon: Icons.arrow_downward_rounded,
                  label: 'Recevoir',
                  onTap: () {},
                ),
                const SizedBox(width: 12),
                _buildCardAction(
                  icon: Icons.history_rounded,
                  label: 'Historique',
                  onTap: () => Navigator.pushNamed(context, '/history'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCardAction({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white12,
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Column(
            children: [
              Icon(icon, color: Colors.white, size: 20),
              const SizedBox(height: 4),
              Text(
                label,
                style: const TextStyle(
                  fontFamily: 'Sora',
                  color: Colors.white70,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMicSection() {
    return Column(
      children: [
        Text(
          _micState == MicState.idle
              ? 'Appuyez pour parler'
              : _micState == MicState.listening
                  ? 'Écoute en cours...'
                  : 'Traitement...',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: _micState == MicState.listening
                    ? AppColors.amber
                    : AppColors.textSecondary,
              ),
        ),
        const SizedBox(height: 20),
        MicButton(
          state: _micState,
          onTap: _onMicTap,
          size: 72,
        ),
        const SizedBox(height: 20),
        VoiceTranscriptBubble(
          text: _transcript,
          isVisible: _transcript.isNotEmpty,
        ),
        if (_transcript.isEmpty && _micState == MicState.idle)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              '"Envoie 5000 à Maman" · "Quel est mon solde ?"',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontSize: 12,
                    color: AppColors.textHint,
                  ),
              textAlign: TextAlign.center,
            ),
          ),
      ],
    );
  }

  Widget _buildQuickActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Text(
            'Contacts rapides',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 88,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 24),
            separatorBuilder: (_, __) => const SizedBox(width: 14),
            itemCount: MockService.quickContacts.length,
            itemBuilder: (_, i) {
              final c = MockService.quickContacts[i];
              return GestureDetector(
                onTap: () {
                  Navigator.pushNamed(
                    context,
                    '/confirmation',
                    arguments: TransactionPreview(
                      type: TransactionType.send,
                      amount: 5000,
                      recipientName: c['name']!,
                      recipientPhone: c['phone'],
                    ),
                  );
                },
                child: Column(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: const Color(0xFFE8ECF0), width: 1),
                      ),
                      child: Center(
                        child: Text(
                          c['initial']!,
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(color: AppColors.navy),
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      c['name']!,
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(fontSize: 12),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildRecentTransactions() {
    final txs = MockService.transactions.take(3).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Row(
            children: [
              Text(
                'Récentes',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => Navigator.pushNamed(context, '/history'),
                child: Text(
                  'Voir tout',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.amber,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Container(
            decoration: AppShadow.card(),
            child: Column(
              children: txs.asMap().entries.map((entry) {
                final i = entry.key;
                final tx = entry.value;
                return Column(
                  children: [
                    _buildTransactionTile(tx),
                    if (i < txs.length - 1)
                      const Divider(
                        height: 1,
                        indent: 68,
                        color: AppColors.surfaceAlt,
                      ),
                  ],
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTransactionTile(transaction) {
    final tx = transaction as dynamic;
    final isCredit = tx.isCredit as bool;
    final color = isCredit ? AppColors.success : AppColors.textPrimary;
    final bgColor = isCredit ? AppColors.successBg : AppColors.surfaceAlt;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: bgColor,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                tx.typeIcon as String,
                style: const TextStyle(fontSize: 18),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tx.label as String,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontSize: 14,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  tx.typeLabel as String,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontSize: 12,
                      ),
                ),
              ],
            ),
          ),
          Text(
            tx.formattedAmount as String,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
          ),
        ],
      ),
    );
  }
}
