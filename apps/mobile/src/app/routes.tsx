import { createBrowserRouter } from "react-router";
import LoginScreen from "./pages/LoginScreen";
import RegisterScreen from "./pages/RegisterScreen";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import HomeScreen from "./pages/HomeScreen";
import TransactionsScreen from "./pages/TransactionsScreen";
import SettingsScreen from "./pages/SettingsScreen";
import ProfileScreen from "./pages/ProfileScreen";
import LanguageScreen from "./pages/LanguageScreen";
import PinScreen from "./pages/PinScreen";
import NotificationsScreen from "./pages/NotificationsScreen";
import VoiceOnlyRedirect from "./components/VoiceOnlyRedirect";
import ContactsScreen from "./pages/ContactsScreen";
import VoiceBiometricScreen from "./pages/VoiceBiometricScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LoginScreen,
  },
  {
    path: "/login",
    Component: LoginScreen,
  },
  {
    path: "/register",
    Component: RegisterScreen,
  },
  {
    path: "/app",
    Component: () => (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, Component: HomeScreen },
      { path: "transactions", Component: TransactionsScreen },
      { path: "settings", Component: SettingsScreen },
      { path: "settings/profile", Component: ProfileScreen },
      { path: "settings/language", Component: LanguageScreen },
      { path: "settings/pin", Component: PinScreen },
      { path: "settings/voice-biometric", Component: VoiceBiometricScreen },
      { path: "notifications", Component: NotificationsScreen },
      { path: "services", Component: VoiceOnlyRedirect },
      { path: "services/:serviceId", Component: VoiceOnlyRedirect },
      { path: "contacts", Component: ContactsScreen },
    ],
  },
]);
