import { createBrowserRouter } from "react-router";
import WelcomeScreen from "./pages/WelcomeScreen";
import LoginScreen from "./pages/LoginScreen";
import Layout from "./components/Layout";
import HomeScreen from "./pages/HomeScreen";
import TransactionsScreen from "./pages/TransactionsScreen";
import SettingsScreen from "./pages/SettingsScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: WelcomeScreen,
  },
  {
    path: "/login",
    Component: LoginScreen,
  },
  {
    path: "/app",
    Component: Layout,
    children: [
      { index: true, Component: HomeScreen },
      { path: "transactions", Component: TransactionsScreen },
      { path: "settings", Component: SettingsScreen },
    ],
  },
]);
