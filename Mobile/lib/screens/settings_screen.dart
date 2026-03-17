import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../models/user.dart';
import '../services/mock_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  static const String _kNameKey = 'settings_full_name';
  static const String _kNotificationsKey = 'settings_notifications';
  static const String _kBiometricKey = 'settings_biometric';
  static const String _kLanguageKey = 'settings_language';

  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();

  static const Map<String, String> _languages = {
    'fr': 'Français',
    'en': 'English',
  };

  AppUser? _user;
  bool _notificationsEnabled = true;
  bool _biometricEnabled = false;
  String _language = 'fr';
  bool _loading = true;
  bool _loggingOut = false;

  @override
  void initState() {
    super.initState();
    _loadUserAndPreferences();
  }

  Future<void> _loadUserAndPreferences() async {
    final user = await MockService.fetchUser();
    final prefs = await SharedPreferences.getInstance();
    final savedName = prefs.getString(_kNameKey) ?? user.fullName;

    if (!mounted) return;
    setState(() {
      _user = AppUser(
        id: user.id,
        fullName: savedName,
        phoneNumber: user.phoneNumber,
        balance: user.balance,
        currency: user.currency,
        avatarUrl: user.avatarUrl,
      );
      _notificationsEnabled = prefs.getBool(_kNotificationsKey) ?? true;
      _biometricEnabled = prefs.getBool(_kBiometricKey) ?? false;
      _language = prefs.getString(_kLanguageKey) ?? 'fr';
      _loading = false;
    });
  }

  Future<void> _saveBoolPreference(String key, bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
  }

  Future<void> _saveStringPreference(String key, String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, value);
  }

  void _confirmLogout() {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.xl)),
        backgroundColor: AppColors.surface,
        title: const Text('Se déconnecter ?'),
        titleTextStyle: const TextStyle(
          fontFamily: 'Sora',
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
        content: Text(
          'Vous devrez entrer votre PIN à la prochaine connexion.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: _loggingOut
                ? null
                : () {
              Navigator.pop(ctx);
              _logout();
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Déconnecter'),
          ),
        ],
      ),
    );
  }

  Future<void> _logout() async {
    setState(() => _loggingOut = true);
    await _secureStorage.delete(key: 'jwt_token');
    ApiService.logout();
    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
  }

  void _showEditNameDialog() {
    final ctrl = TextEditingController(text: _user?.fullName ?? '');
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.xl)),
        backgroundColor: AppColors.surface,
        title: const Text('Modifier le nom'),
        titleTextStyle: const TextStyle(
          fontFamily: 'Sora',
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
        content: TextField(
          controller: ctrl,
          textCapitalization: TextCapitalization.words,
          style: const TextStyle(
            fontFamily: 'Sora',
            color: AppColors.textPrimary,
          ),
          decoration: const InputDecoration(hintText: 'Nom complet'),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () async {
              final newName = ctrl.text.trim();
              if (newName.split(' ').length < 2) {
                ScaffoldMessenger.of(context).showSnackBar(
                  _errorSnack('Entrez au moins prénom + nom'),
                );
                return;
              }
              await _saveStringPreference(_kNameKey, newName);
              if (!mounted) return;
              setState(() {
                final current = _user;
                if (current != null) {
                  _user = AppUser(
                    id: current.id,
                    fullName: newName,
                    phoneNumber: current.phoneNumber,
                    balance: current.balance,
                    currency: current.currency,
                    avatarUrl: current.avatarUrl,
                  );
                }
              });
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                _successSnack('Nom mis à jour'),
              );
            },
            child: const Text('Enregistrer'),
          ),
        ],
      ),
    );
  }

  void _navigateToChangePin() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
        title: const Text('Changer le PIN'),
        content: const Text(
          'Vous allez définir un nouveau PIN en 2 étapes (saisie + confirmation).',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Continuer'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    Navigator.pushNamed(context, '/pin', arguments: {
      'phone': _user?.phoneNumber ?? '',
      'fullName': _user?.fullName,
      'isCreating': true,
    });
  }

  void _showLanguageSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.textHint,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 12),
              const ListTile(
                title: Text(
                  'Choisir la langue',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              ..._languages.entries.map((entry) {
                final selected = _language == entry.key;
                return ListTile(
                  title: Text(entry.value),
                  trailing: selected
                      ? const Icon(Icons.check_rounded, color: AppColors.navy)
                      : null,
                  onTap: () async {
                    await _saveStringPreference(_kLanguageKey, entry.key);
                    if (!mounted) return;
                    setState(() => _language = entry.key);
                    if (!ctx.mounted) return;
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      _successSnack('Langue mise à jour: ${entry.value}'),
                    );
                  },
                );
              }),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  void _showHelpAndFaq() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'Aide & FAQ',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  SizedBox(height: 14),
                  Text('• PIN démo: 1234'),
                  SizedBox(height: 8),
                  Text(
                    '• Commandes vocales supportées:\n'
                    '  - "Envoie 5000 à Maman"\n'
                    '  - "Recharge 2000"\n'
                    '  - "Quel est mon solde ?" ',
                  ),
                  SizedBox(height: 8),
                  Text(
                    '• En cas de problème de connexion web, lancez l\'app en serveur web puis ouvrez le lien dans votre navigateur.',
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _showAbout() {
    showAboutDialog(
      context: context,
      applicationName: 'VoiceMoney',
      applicationVersion: 'v1.0.0',
      applicationLegalese: 'Application Mobile Money a commandes vocales',
      children: const [
        SizedBox(height: 8),
        Text(
          'Prototype frontend Flutter avec navigation, transactions et assistants vocaux.',
        ),
      ],
    );
  }

  SnackBar _successSnack(String message) {
    return SnackBar(
      content: Row(
        children: [
          const Icon(Icons.check_circle_outline_rounded,
              color: Colors.white, size: 18),
          const SizedBox(width: 10),
          Text(message),
        ],
      ),
      backgroundColor: AppColors.success,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md)),
      duration: const Duration(seconds: 2),
    );
  }

  SnackBar _errorSnack(String message) {
    return SnackBar(
      content: Text(message),
      backgroundColor: AppColors.error,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      duration: const Duration(seconds: 2),
    );
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
        title: const Text('Paramètres'),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.navy))
          : ListView(
              padding: const EdgeInsets.symmetric(vertical: 16),
              children: [
                _buildProfileHeader(),
                const SizedBox(height: 28),
                _buildSection(
                  title: 'COMPTE',
                  items: [
                    _SettingsTile(
                      icon: Icons.person_outline_rounded,
                      label: 'Modifier le nom',
                      value: _user?.fullName,
                      onTap: _showEditNameDialog,
                    ),
                    _SettingsTile(
                      icon: Icons.phone_android_rounded,
                      label: 'Numéro de téléphone',
                      value: _user?.phoneNumber,
                      onTap: null, // lecture seule
                      trailing: const SizedBox.shrink(),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                _buildSection(
                  title: 'SÉCURITÉ',
                  items: [
                    _SettingsTile(
                      icon: Icons.lock_outline_rounded,
                      label: 'Changer le PIN',
                      onTap: _navigateToChangePin,
                    ),
                    _SettingsTile(
                      icon: Icons.fingerprint_rounded,
                      label: 'Déverrouillage biométrique',
                      onTap: null,
                      trailing: Switch(
                        value: _biometricEnabled,
                        onChanged: (v) async {
                          setState(() => _biometricEnabled = v);
                          await _saveBoolPreference(_kBiometricKey, v);
                        },
                        activeThumbColor: AppColors.navy,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                _buildSection(
                  title: 'PRÉFÉRENCES',
                  items: [
                    _SettingsTile(
                      icon: Icons.notifications_none_rounded,
                      label: 'Notifications',
                      onTap: null,
                      trailing: Switch(
                        value: _notificationsEnabled,
                        onChanged: (v) async {
                          setState(() => _notificationsEnabled = v);
                          await _saveBoolPreference(_kNotificationsKey, v);
                        },
                        activeThumbColor: AppColors.navy,
                      ),
                    ),
                    _SettingsTile(
                      icon: Icons.language_rounded,
                      label: 'Langue',
                      value: _languages[_language] ?? 'Français',
                      onTap: _showLanguageSheet,
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                _buildSection(
                  title: 'SUPPORT',
                  items: [
                    _SettingsTile(
                      icon: Icons.help_outline_rounded,
                      label: 'Aide & FAQ',
                      onTap: _showHelpAndFaq,
                    ),
                    _SettingsTile(
                      icon: Icons.info_outline_rounded,
                      label: 'À propos',
                      value: 'VoiceMoney v1.0.0',
                      onTap: _showAbout,
                    ),
                  ],
                ),
                const SizedBox(height: 32),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: OutlinedButton.icon(
                      onPressed: _loggingOut ? null : _confirmLogout,
                      icon: const Icon(Icons.logout_rounded,
                          color: AppColors.error, size: 18),
                      label: const Text(
                        'Se déconnecter',
                        style: TextStyle(
                          fontFamily: 'Sora',
                          color: AppColors.error,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.error),
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(AppRadius.full),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
    );
  }

  Widget _buildProfileHeader() {
    final user = _user;
    final initials = user != null
        ? user.fullName
            .split(' ')
            .take(2)
            .map((w) => w.isNotEmpty ? w[0].toUpperCase() : '')
            .join()
        : '?';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: AppShadow.card(),
        child: Row(
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.navy, AppColors.navyLight],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  initials,
                  style: const TextStyle(
                    fontFamily: 'Sora',
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user?.fullName ?? '',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    user?.phoneNumber ?? '',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            GestureDetector(
              onTap: _showEditNameDialog,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: const Icon(Icons.edit_outlined,
                    color: AppColors.textSecondary, size: 16),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required List<_SettingsTile> items,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 10),
          child: Text(title, style: Theme.of(context).textTheme.labelLarge),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Container(
            decoration: AppShadow.card(),
            child: Column(
              children: items.asMap().entries.map((entry) {
                final i = entry.key;
                final tile = entry.value;
                return Column(
                  children: [
                    _buildTile(tile),
                    if (i < items.length - 1)
                      const Divider(
                        height: 1,
                        indent: 56,
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

  Widget _buildTile(_SettingsTile tile) {
    return InkWell(
      onTap: tile.onTap,
      borderRadius: BorderRadius.circular(AppRadius.xl),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Icon(tile.icon,
                  color: AppColors.textSecondary, size: 18),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tile.label,
                      style: Theme.of(context).textTheme.titleMedium),
                  if (tile.value != null) ...[
                    const SizedBox(height: 2),
                    Text(tile.value!,
                        style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ],
              ),
            ),
            tile.trailing ??
                (tile.onTap != null
                    ? const Icon(Icons.chevron_right_rounded,
                        color: AppColors.textHint, size: 20)
                    : const SizedBox.shrink()),
          ],
        ),
      ),
    );
  }
}

class _SettingsTile {
  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback? onTap;
  final Widget? trailing;

  const _SettingsTile({
    required this.icon,
    required this.label,
    this.value,
    this.onTap,
    this.trailing,
  });
}
