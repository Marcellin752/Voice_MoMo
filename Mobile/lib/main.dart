import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'theme/app_theme.dart';
import 'screens/login_screen.dart';
import 'screens/pin_screen.dart';
import 'screens/home_screen.dart';
import 'screens/history_screen.dart';
import 'screens/confirmation_screen.dart';
import 'screens/notifications_screen.dart';
import 'models/transaction.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('fr_FR');
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const VoiceMoneyApp());
}

class VoiceMoneyApp extends StatelessWidget {
  const VoiceMoneyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VoiceMoney',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      initialRoute: '/login',
      onGenerateRoute: (settings) {
        switch (settings.name) {
          case '/login':
            return _fadeRoute(const LoginScreen(), settings);
          case '/pin':
            final phone = settings.arguments as String? ?? '';
            return _slideRoute(PinScreen(phoneNumber: phone), settings);
          case '/home':
            return _fadeRoute(const HomeScreen(), settings);
          case '/history':
            return _slideRoute(const HistoryScreen(), settings);
          case '/notifications':
            return _slideRoute(const NotificationsScreen(), settings);
          case '/confirmation':
            final tx = settings.arguments as TransactionPreview;
            return _slideRoute(ConfirmationScreen(preview: tx), settings);
          default:
            return _fadeRoute(const LoginScreen(), settings);
        }
      },
    );
  }

  PageRoute _fadeRoute(Widget page, RouteSettings settings) {
    return PageRouteBuilder(
      settings: settings,
      pageBuilder: (_, __, ___) => page,
      transitionsBuilder: (_, animation, __, child) =>
          FadeTransition(opacity: animation, child: child),
      transitionDuration: const Duration(milliseconds: 350),
    );
  }

  PageRoute _slideRoute(Widget page, RouteSettings settings) {
    return PageRouteBuilder(
      settings: settings,
      pageBuilder: (_, __, ___) => page,
      transitionsBuilder: (_, animation, __, child) {
        const begin = Offset(1.0, 0.0);
        const end = Offset.zero;
        final tween =
            Tween(begin: begin, end: end).chain(CurveTween(curve: Curves.easeOutCubic));
        return SlideTransition(position: animation.drive(tween), child: child);
      },
      transitionDuration: const Duration(milliseconds: 380),
    );
  }
}

/// Compatibility test wrapper (ancien test template utilisant MyApp)
class MyApp extends VoiceMoneyApp {
  const MyApp({super.key});
}
