// ──────────────────────────────────────────────────────
// models/transaction.dart
// ──────────────────────────────────────────────────────
enum TransactionType { send, receive, recharge, payment }

enum TransactionStatus { pending, success, failed }

class Transaction {
  final String id;
  final TransactionType type;
  final TransactionStatus status;
  final double amount;
  final String currency;
  final String label;         // ex: "Jean Kouassi"
  final String? phoneNumber;
  final DateTime date;
  final String? note;

  const Transaction({
    required this.id,
    required this.type,
    required this.status,
    required this.amount,
    this.currency = 'FCFA',
    required this.label,
    this.phoneNumber,
    required this.date,
    this.note,
  });

  /// Direction du flux  (+/-)
  bool get isCredit => type == TransactionType.receive;

  String get formattedAmount {
    final sign = isCredit ? '+' : '-';
    return '$sign${amount.toStringAsFixed(0)} $currency';
  }

  String get typeLabel {
    switch (type) {
      case TransactionType.send:
        return 'Transfert envoyé';
      case TransactionType.receive:
        return 'Transfert reçu';
      case TransactionType.recharge:
        return 'Recharge crédit';
      case TransactionType.payment:
        return 'Paiement facture';
    }
  }

  String get typeIcon {
    switch (type) {
      case TransactionType.send:
        return '↑';
      case TransactionType.receive:
        return '↓';
      case TransactionType.recharge:
        return '⚡';
      case TransactionType.payment:
        return '🧾';
    }
  }

  /// Créer depuis JSON (backend)
  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] as String,
      type: TransactionType.values.firstWhere(
        (e) => e.name == json['type'],
        orElse: () => TransactionType.send,
      ),
      status: TransactionStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => TransactionStatus.pending,
      ),
      amount: (json['amount'] as num).toDouble(),
      currency: json['currency'] as String? ?? 'FCFA',
      label: json['label'] as String,
      phoneNumber: json['phone_number'] as String?,
      date: DateTime.parse(json['date'] as String),
      note: json['note'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'status': status.name,
        'amount': amount,
        'currency': currency,
        'label': label,
        'phone_number': phoneNumber,
        'date': date.toIso8601String(),
        'note': note,
      };
}

// ──────────────────────────────────────────────────────
// TransactionPreview — utilisé pour l'écran de confirmation
// ──────────────────────────────────────────────────────
class TransactionPreview {
  final TransactionType type;
  final double amount;
  final String currency;
  final String recipientName;
  final String? recipientPhone;
  final String? serviceLabel;

  const TransactionPreview({
    required this.type,
    required this.amount,
    this.currency = 'FCFA',
    required this.recipientName,
    this.recipientPhone,
    this.serviceLabel,
  });

  String get description {
    switch (type) {
      case TransactionType.send:
        return 'Envoyer à $recipientName';
      case TransactionType.recharge:
        return 'Recharge crédit $recipientName';
      case TransactionType.payment:
        return 'Payer ${serviceLabel ?? recipientName}';
      default:
        return recipientName;
    }
  }
}
