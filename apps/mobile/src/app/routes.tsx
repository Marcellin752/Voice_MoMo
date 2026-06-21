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
import ServicesHubScreen from "./pages/ServicesHubScreen";
import ServiceActionScreen from "./pages/ServiceActionScreen";
import ContactsScreen from "./pages/ContactsScreen";

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
      { path: "notifications", Component: NotificationsScreen },
      { path: "services", Component: ServicesHubScreen },
      { path: "services/:serviceId", Component: ServiceActionScreen },
      { path: "contacts", Component: ContactsScreen },
    ],
  },
]);
