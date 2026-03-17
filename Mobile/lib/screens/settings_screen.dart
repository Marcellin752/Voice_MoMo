import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/user.dart';
import '../services/mock_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  AppUser? _user;
  bool _notificationsEnabled = true;
  bool _biometricEnabled = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final user = await MockService.fetchUser();
    if (mounted) setState(() { _user = user; _loading = false; });
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
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pushNamedAndRemoveUntil(
                  context, '/login', (_) => false);
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Déconnecter'),
          ),
        ],
      ),
    );
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
            onPressed: () {
              // TODO: appeler ApiService pour sauvegarder
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

  void _navigateToChangePin() {
    Navigator.pushNamed(context, '/pin', arguments: {
      'phone': _user?.phoneNumber ?? '',
      'fullName': _user?.fullName,
      'isCreating': true,
    });
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
                        onChanged: (v) =>
                            setState(() => _biometricEnabled = v),
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
                        onChanged: (v) =>
                            setState(() => _notificationsEnabled = v),
                        activeThumbColor: AppColors.navy,
                      ),
                    ),
                    _SettingsTile(
                      icon: Icons.language_rounded,
                      label: 'Langue',
                      value: 'Français',
                      onTap: () {},
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
                      onTap: () {},
                    ),
                    _SettingsTile(
                      icon: Icons.info_outline_rounded,
                      label: 'À propos',
                      value: 'VoiceMoney v1.0.0',
                      onTap: () {},
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
                      onPressed: _confirmLogout,
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
