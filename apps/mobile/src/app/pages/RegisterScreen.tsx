import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function RegisterScreen() {
  const navigate = useNavigate();

  // Puisque l'inscription est désormais gérée de manière transparente 
  // via l'OTP sur la page de connexion, nous redirigeons automatiquement 
  // vers /login pour simplifier le parcours utilisateur.
  useEffect(() => {
    navigate("/login", { replace: true });
  }, [navigate]);

  return null;
}
