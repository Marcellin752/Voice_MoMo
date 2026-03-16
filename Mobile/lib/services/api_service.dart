import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/transaction.dart';
import '../models/user.dart';

/// Service API réel — connecté au backend FastAPI.
/// Basculer de [MockService] vers [ApiService] quand le backend est prêt.
class ApiService {
  // ── Configuration ─────────────────────────────────────
  static const String _baseUrl = 'https://voicemoney-api.example.com/api/v1';
  static String? _authToken;

  // ── Headers ───────────────────────────────────────────
  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (_authToken != null) 'Authorization': 'Bearer $_authToken',
      };

  // ── Auth ──────────────────────────────────────────────

  /// Connexion — renvoie un JWT si succès
  static Future<AuthResult> login({
    required String phoneNumber,
    required String pin,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/auth/login'),
      headers: _headers,
      body: jsonEncode({'phone_number': phoneNumber, 'pin': pin}),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 200) {
      _authToken = data['access_token'] as String;
      return AuthResult.success(token: _authToken!);
    }

    return AuthResult.failure(message: data['detail'] as String? ?? 'Erreur');
  }

  /// Inscription
  static Future<AuthResult> register({
    required String fullName,
    required String phoneNumber,
    required String pin,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/auth/register'),
      headers: _headers,
      body: jsonEncode({
        'full_name': fullName,
        'phone_number': phoneNumber,
        'pin': pin,
      }),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 201) {
      _authToken = data['access_token'] as String;
      return AuthResult.success(token: _authToken!);
    }

    return AuthResult.failure(message: data['detail'] as String? ?? 'Erreur');
  }

  static void logout() => _authToken = null;

  // ── Utilisateur ───────────────────────────────────────

  static Future<AppUser> fetchCurrentUser() async {
    final response = await http.get(
      Uri.parse('$_baseUrl/users/me'),
      headers: _headers,
    );
    _assertSuccess(response);
    return AppUser.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  static Future<double> fetchBalance() async {
    final response = await http.get(
      Uri.parse('$_baseUrl/users/me/balance'),
      headers: _headers,
    );
    _assertSuccess(response);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['balance'] as num).toDouble();
  }

  // ── Transactions ──────────────────────────────────────

  static Future<List<Transaction>> fetchTransactions({
    int page = 1,
    int limit = 20,
  }) async {
    final response = await http.get(
      Uri.parse('$_baseUrl/transactions?page=$page&limit=$limit'),
      headers: _headers,
    );
    _assertSuccess(response);
    final list = jsonDecode(response.body) as List<dynamic>;
    return list
        .map((e) => Transaction.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Initier un transfert d'argent
  static Future<TransactionResult> sendMoney({
    required String recipientPhone,
    required double amount,
    String? note,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/transactions/send'),
      headers: _headers,
      body: jsonEncode({
        'recipient_phone': recipientPhone,
        'amount': amount,
        'note': note,
      }),
    );
    return _parseTransactionResult(response);
  }

  /// Recharge crédit téléphonique
  static Future<TransactionResult> recharge({
    required String phoneNumber,
    required double amount,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/transactions/recharge'),
      headers: _headers,
      body: jsonEncode({'phone_number': phoneNumber, 'amount': amount}),
    );
    return _parseTransactionResult(response);
  }

  /// Paiement facture
  static Future<TransactionResult> payBill({
    required String serviceCode,
    required double amount,
    required String accountNumber,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/transactions/pay-bill'),
      headers: _headers,
      body: jsonEncode({
        'service_code': serviceCode,
        'amount': amount,
        'account_number': accountNumber,
      }),
    );
    return _parseTransactionResult(response);
  }

  // ── Commandes vocales ─────────────────────────────────

  /// Envoyer le texte transcrit au moteur NLP
  static Future<VoiceCommandResult> processVoiceCommand(String text) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/voice/parse'),
      headers: _headers,
      body: jsonEncode({'text': text}),
    );
    _assertSuccess(response);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return VoiceCommandResult.fromJson(data);
  }

  // ── Helpers privés ────────────────────────────────────

  static void _assertSuccess(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        statusCode: response.statusCode,
        message: _extractError(response.body),
      );
    }
  }

  static TransactionResult _parseTransactionResult(http.Response response) {
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 200 || response.statusCode == 201) {
      return TransactionResult.success(
        transactionId: data['transaction_id'] as String,
      );
    }
    return TransactionResult.failure(
      message: data['detail'] as String? ?? 'Erreur de transaction',
    );
  }

  static String _extractError(String body) {
    try {
      final data = jsonDecode(body) as Map<String, dynamic>;
      return data['detail'] as String? ?? 'Erreur serveur';
    } catch (_) {
      return 'Erreur serveur';
    }
  }
}

// ──────────────────────────────────────────────────────
// Modèles de résultats
// ──────────────────────────────────────────────────────

class AuthResult {
  final bool success;
  final String? token;
  final String? message;

  const AuthResult._({required this.success, this.token, this.message});

  factory AuthResult.success({required String token}) =>
      AuthResult._(success: true, token: token);

  factory AuthResult.failure({required String message}) =>
      AuthResult._(success: false, message: message);
}

class TransactionResult {
  final bool success;
  final String? transactionId;
  final String? message;

  const TransactionResult._({
    required this.success,
    this.transactionId,
    this.message,
  });

  factory TransactionResult.success({required String transactionId}) =>
      TransactionResult._(success: true, transactionId: transactionId);

  factory TransactionResult.failure({required String message}) =>
      TransactionResult._(success: false, message: message);
}

class VoiceCommandResult {
  final String action;       // 'send', 'balance', 'recharge', 'pay'
  final double? amount;
  final String? recipient;
  final String? phoneNumber;
  final double confidence;
  final String rawText;

  const VoiceCommandResult({
    required this.action,
    this.amount,
    this.recipient,
    this.phoneNumber,
    required this.confidence,
    required this.rawText,
  });

  factory VoiceCommandResult.fromJson(Map<String, dynamic> json) {
    return VoiceCommandResult(
      action: json['action'] as String,
      amount: json['amount'] != null ? (json['amount'] as num).toDouble() : null,
      recipient: json['recipient'] as String?,
      phoneNumber: json['phone_number'] as String?,
      confidence: (json['confidence'] as num).toDouble(),
      rawText: json['raw_text'] as String,
    );
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;

  const ApiException({required this.statusCode, required this.message});

  @override
  String toString() => 'ApiException($statusCode): $message';
}
