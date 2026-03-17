import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/transaction.dart';
import '../services/mock_service.dart';
import 'package:intl/intl.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  int _selectedFilter = 0;
  List<Transaction> _allTx = [];
  bool _loading = true;

  final List<String> _filters = ['Tout', 'Envois', 'Reçus', 'Recharges', 'Factures'];

  @override
  void initState() {
    super.initState();
    _loadTransactions();
  }

  Future<void> _loadTransactions() async {
    final data = await MockService.fetchTransactions();
    // Remplacer par: await ApiService.fetchTransactions()
    if (!mounted) return;
    setState(() {
      _allTx = data;
      _loading = false;
    });
  }

  List<Transaction> get _filtered {
    switch (_selectedFilter) {
      case 1:
        return _allTx.where((t) => t.type == TransactionType.send).toList();
      case 2:
        return _allTx.where((t) => t.type == TransactionType.receive).toList();
      case 3:
        return _allTx.where((t) => t.type == TransactionType.recharge).toList();
      case 4:
        return _allTx.where((t) => t.type == TransactionType.payment).toList();
      default:
        return _allTx;
    }
  }

  /// Regrouper par date
  Map<String, List<Transaction>> get _grouped {
    final map = <String, List<Transaction>>{};
    for (final tx in _filtered) {
      final key = _dayLabel(tx.date);
      map.putIfAbsent(key, () => []).add(tx);
    }
    return map;
  }

  String _dayLabel(DateTime d) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(d.year, d.month, d.day);

    if (day == today) return "Aujourd'hui";
    if (day == today.subtract(const Duration(days: 1))) return 'Hier';
    return DateFormat('d MMMM yyyy', 'fr_FR').format(d);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Historique'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.tune_rounded, size: 20),
            color: AppColors.textSecondary,
            onPressed: () {}, // TODO: filtre avancé
          ),
        ],
      ),
      body: Column(
        children: [
          _buildFilterTabs(),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.navy))
                : _filtered.isEmpty
                    ? _buildEmpty()
                    : _buildList(),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTabs() {
    return Container(
      height: 44,
      margin: const EdgeInsets.only(top: 8, bottom: 4),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 24),
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: _filters.length,
        itemBuilder: (_, i) {
          final active = i == _selectedFilter;
          return GestureDetector(
            onTap: () => setState(() => _selectedFilter = i),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
              decoration: BoxDecoration(
                color: active ? AppColors.navy : AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadius.full),
                border: Border.all(
                  color: active ? AppColors.navy : const Color(0xFFE8ECF0),
                  width: 1,
                ),
              ),
              child: Text(
                _filters[i],
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: active ? Colors.white : AppColors.textSecondary,
                      fontWeight:
                          active ? FontWeight.w600 : FontWeight.w400,
                      fontSize: 13,
                    ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildList() {
    final grouped = _grouped;
    final entries = grouped.entries.toList();

    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      itemCount: entries.length,
      itemBuilder: (_, i) {
        final entry = entries[i];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 20, bottom: 10),
              child: Text(
                entry.key,
                style: Theme.of(context).textTheme.labelLarge,
              ),
            ),
            Container(
              decoration: AppShadow.card(),
              child: Column(
                children: entry.value.asMap().entries.map((e) {
                  final idx = e.key;
                  final tx = e.value;
                  return Column(
                    children: [
                      _TransactionTile(transaction: tx),
                      if (idx < entry.value.length - 1)
                        const Divider(
                          height: 1,
                          indent: 70,
                          color: AppColors.surfaceAlt,
                        ),
                    ],
                  );
                }).toList(),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.receipt_long_outlined,
              size: 56, color: AppColors.textHint),
          const SizedBox(height: 16),
          Text(
            'Aucune transaction',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Vos transactions apparaîtront ici.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  final Transaction transaction;

  const _TransactionTile({required this.transaction});

  Color get _iconBg {
    switch (transaction.type) {
      case TransactionType.receive:
        return AppColors.successBg;
      case TransactionType.send:
        return AppColors.surfaceAlt;
      case TransactionType.recharge:
        return const Color(0xFFFFF3E0);
      case TransactionType.payment:
        return const Color(0xFFE3F2FD);
    }
  }

  Color get _amountColor =>
      transaction.isCredit ? AppColors.success : AppColors.textPrimary;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration:
                BoxDecoration(color: _iconBg, shape: BoxShape.circle),
            child: Center(
              child: Text(
                transaction.typeIcon,
                style: const TextStyle(fontSize: 20),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  transaction.label,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Text(
                      transaction.typeLabel,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontSize: 12,
                          ),
                    ),
                    if (transaction.status == TransactionStatus.failed) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.errorBg,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'Échoué',
                          style: TextStyle(
                            fontFamily: 'Sora',
                            color: AppColors.error,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                transaction.formattedAmount,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: transaction.status == TransactionStatus.failed
                          ? AppColors.textSecondary
                          : _amountColor,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      decoration: transaction.status == TransactionStatus.failed
                          ? TextDecoration.lineThrough
                          : null,
                    ),
              ),
              const SizedBox(height: 3),
              Text(
                _formatTime(transaction.date),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontSize: 11,
                    ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime date) {
    final h = date.hour.toString().padLeft(2, '0');
    final m = date.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}
