class AppUser {
  final String id;
  final String fullName;
  final String phoneNumber;
  final double balance;
  final String currency;
  final String? avatarUrl;

  const AppUser({
    required this.id,
    required this.fullName,
    required this.phoneNumber,
    required this.balance,
    this.currency = 'FCFA',
    this.avatarUrl,
  });

  String get firstName => fullName.split(' ').first;

  String get formattedBalance =>
      '${balance.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]} ')} $currency';

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as String,
      fullName: json['full_name'] as String,
      phoneNumber: json['phone_number'] as String,
      balance: (json['balance'] as num).toDouble(),
      currency: json['currency'] as String? ?? 'FCFA',
      avatarUrl: json['avatar_url'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'full_name': fullName,
        'phone_number': phoneNumber,
        'balance': balance,
        'currency': currency,
        'avatar_url': avatarUrl,
      };
}
