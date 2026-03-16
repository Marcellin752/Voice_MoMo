import '../models/transaction.dart';
import '../models/user.dart';

/// Service de données fictives pour la démo et les tests.
/// Remplacer les appels par [ApiService] en production.
class MockService {
  static final MockService _instance = MockService._internal();
  factory MockService() => _instance;
  MockService._internal();

  // ── Utilisateur courant ───────────────────────────────
  static AppUser get currentUser => const AppUser(
        id: 'u001',
        fullName: 'Kouassi Adjoua',
        phoneNumber: '+229 96 00 11 22',
        balance: 87500,
        currency: 'FCFA',
      );

  // ── Contacts rapides ──────────────────────────────────
  static List<Map<String, String>> get quickContacts => [
        {'name': 'Maman', 'phone': '+229 97 00 33 44', 'initial': 'M'},
        {'name': 'Jean', 'phone': '+229 95 00 55 66', 'initial': 'J'},
        {'name': 'Papa', 'phone': '+229 96 77 88 99', 'initial': 'P'},
        {'name': 'Sœur', 'phone': '+229 94 11 22 33', 'initial': 'S'},
      ];

  // ── Historique transactions ───────────────────────────
  static List<Transaction> get transactions => [
        Transaction(
          id: 'tx010',
          type: TransactionType.receive,
          status: TransactionStatus.success,
          amount: 25000,
          label: 'Jean Kouassi',
          phoneNumber: '+229 95 00 55 66',
          date: DateTime.now().subtract(const Duration(hours: 2)),
          note: 'Remboursement repas',
        ),
        Transaction(
          id: 'tx009',
          type: TransactionType.send,
          status: TransactionStatus.success,
          amount: 5000,
          label: 'Maman',
          phoneNumber: '+229 97 00 33 44',
          date: DateTime.now().subtract(const Duration(days: 1)),
        ),
        Transaction(
          id: 'tx008',
          type: TransactionType.recharge,
          status: TransactionStatus.success,
          amount: 2000,
          label: 'Recharge MTN',
          phoneNumber: '+229 96 00 11 22',
          date: DateTime.now().subtract(const Duration(days: 2)),
        ),
        Transaction(
          id: 'tx007',
          type: TransactionType.payment,
          status: TransactionStatus.success,
          amount: 12500,
          label: 'SBEE - Électricité',
          date: DateTime.now().subtract(const Duration(days: 3)),
        ),
        Transaction(
          id: 'tx006',
          type: TransactionType.send,
          status: TransactionStatus.success,
          amount: 15000,
          label: 'Papa',
          phoneNumber: '+229 96 77 88 99',
          date: DateTime.now().subtract(const Duration(days: 5)),
        ),
        Transaction(
          id: 'tx005',
          type: TransactionType.receive,
          status: TransactionStatus.success,
          amount: 50000,
          label: 'Laurince AGANI',
          phoneNumber: '+229 97 44 55 66',
          date: DateTime.now().subtract(const Duration(days: 7)),
          note: 'Salaire partiel',
        ),
        Transaction(
          id: 'tx004',
          type: TransactionType.payment,
          status: TransactionStatus.failed,
          amount: 8000,
          label: 'SONEB - Eau',
          date: DateTime.now().subtract(const Duration(days: 8)),
        ),
        Transaction(
          id: 'tx003',
          type: TransactionType.recharge,
          status: TransactionStatus.success,
          amount: 1000,
          label: 'Recharge Moov',
          phoneNumber: '+229 96 00 11 22',
          date: DateTime.now().subtract(const Duration(days: 10)),
        ),
      ];

  // ── Simulation délai réseau ───────────────────────────
  static Future<T> fakeDelay<T>(T value, {int ms = 900}) async {
    await Future.delayed(Duration(milliseconds: ms));
    return value;
  }

  static Future<AppUser> fetchUser() => fakeDelay(currentUser);

  static Future<List<Transaction>> fetchTransactions() =>
      fakeDelay(transactions);

  static Future<double> fetchBalance() => fakeDelay(currentUser.balance);

  static Future<bool> verifyPin(String pin) async {
    await Future.delayed(const Duration(milliseconds: 800));
    return pin == '1234'; // PIN démo
  }

  static Future<bool> executeTransaction(TransactionPreview preview) async {
    await Future.delayed(const Duration(milliseconds: 1200));
    return true; // Toujours succès en démo
  }
}
