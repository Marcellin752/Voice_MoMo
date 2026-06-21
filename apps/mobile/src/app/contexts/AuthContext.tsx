import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { ApiUser } from '../utils/api';
import { StorageService } from '../services/storage.service';
import { setApiToken } from '../utils/api';
import { normalizeSenderUser } from '../utils/authUser';
import { motion, AnimatePresence } from 'motion/react';
import { Mic } from 'lucide-react';

type AuthContextType = {
  token: string | null;
  user: ApiUser | null;
  loading: boolean;
  setAuth: (token: string, user: ApiUser) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialisation asynchrone sécurisée de la session depuis le stockage natif Android / local
  useEffect(() => {
    async function initSession() {
      try {
        console.log('🔄 [AUTH] Restauration asynchrone de la session...');
        
        // Synchronisation globale natif -> local avant tout chargement
        await StorageService.syncToLocalStorage();
        
        const storedToken = await StorageService.get<string>('momo.auth.token');
        const storedUser = await StorageService.get<ApiUser>('momo.auth.user');
        
        if (storedToken && storedUser) {
          let normalizedUser: ApiUser;
          try {
            normalizedUser = normalizeSenderUser(storedUser);
          } catch (err) {
            console.warn('⚠️ [AUTH] Session invalide (numéro non MTN ou mal formaté), déconnexion.', err);
            await StorageService.remove('momo.auth.token');
            await StorageService.remove('momo.auth.user');
            setApiToken(null);
            return;
          }

          if (normalizedUser.phone !== storedUser.phone) {
            await StorageService.set('momo.auth.user', normalizedUser);
          }

          setToken(storedToken);
          setUser(normalizedUser);
          setApiToken(storedToken); // Enregistrement synchrone pour les appels HTTP
          console.log(`✅ [AUTH] Session restaurée avec succès pour le numéro : ${normalizedUser.phone}`);
        } else {
          console.log('ℹ️ [AUTH] Aucune session active trouvée.');
        }
      } catch (err) {
        console.error('❌ [AUTH] Échec de la restauration de session:', err);
      } finally {
        // Ajout d'un léger délai artificiel pour permettre à l'animation d'être visible et fluide
        setTimeout(() => setLoading(false), 1200);
      }
    }
    initSession();
  }, []);

  const setAuth = async (newToken: string, newUser: ApiUser) => {
    const normalizedUser = normalizeSenderUser(newUser);
    await StorageService.set('momo.auth.token', newToken);
    await StorageService.set('momo.auth.user', normalizedUser);
    setApiToken(newToken);
    setToken(newToken);
    setUser(normalizedUser);
    console.log(`💾 [AUTH] Session enregistrée pour ${normalizedUser.phone}.`);
  };

  const logout = async () => {
    try {
      await StorageService.remove('momo.auth.token');
      await StorageService.remove('momo.auth.user');
      setApiToken(null);
      setToken(null);
      setUser(null);
      console.log('🧹 [AUTH] Session fermée et nettoyée.');
    } catch (err) {
      console.error('[AUTH] Erreur déconnexion:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, setAuth, logout }}>
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="auth-loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center h-[100dvh] w-full max-w-md mx-auto bg-[#FFCC00] text-[#004F71] relative overflow-hidden"
          >
            {/* Background elements */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#004F71]/10 rounded-full blur-3xl" />

            <div className="flex flex-col items-center space-y-6 z-10">
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  boxShadow: ["0 0 0 0px rgba(0, 79, 113, 0.2)", "0 0 0 30px rgba(0, 79, 113, 0)"]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: "easeInOut"
                }}
                className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-2xl shadow-[#004F71]/10"
              >
                <Mic className="text-[#004F71] w-12 h-12" />
              </motion.div>

              <div className="text-center space-y-2">
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-black tracking-tighter"
                >
                  MoMo Voice
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{ delay: 0.5 }}
                  className="text-xs font-bold uppercase tracking-widest"
                >
                  Initialisation sécurisée...
                </motion.p>
              </div>

              {/* Progress Bar loader */}
              <div className="w-36 h-1.5 bg-[#004F71]/20 rounded-full overflow-hidden mt-4">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  className="h-full bg-[#004F71]"
                />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="auth-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full h-full"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
