import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

/** Redirige les anciennes routes manuelles vers l'accueil (opérations 100 % vocales). */
export default function VoiceOnlyRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    toast.info('Utilisez le micro : toutes les opérations se font par la voix.');
    navigate('/app', { replace: true });
  }, [navigate]);

  return null;
}
