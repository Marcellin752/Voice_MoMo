import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from './routes';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';

// Sans <Toaster /> monté, tous les toast.error()/success() de l'app (connexion, accueil…)
// n'affichent rien : l'utilisateur voyait « ça tourne » puis plus rien en cas d'erreur.
function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-center"
      theme={theme}
      richColors
      closeButton
      duration={8000}
      toastOptions={{ style: { fontSize: '1rem', fontWeight: 700 } }}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
          <RouterProvider router={router} />
          <AppToaster />
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
