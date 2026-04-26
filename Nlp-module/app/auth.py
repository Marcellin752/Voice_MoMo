"""
🔐 Gestion d'authentification JWT pour VoiceMomo
"""

import jwt
import os
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from functools import wraps
from fastapi import HTTPException, Request, status
import logging

logger = logging.getLogger(__name__)

# Configuration JWT - À overrider via .env
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))


class JWTManager:
    """Gestionnaire des tokens JWT pour authentification utilisateur"""
    
    @staticmethod
    def encode_token(user_id: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Créer un token JWT pour un utilisateur
        
        Args:
            user_id: ID unique de l'utilisateur
            metadata: Données additionnelles à inclure dans le token
        
        Returns:
            Token JWT encodé (string)
        """
        payload = {
            "user_id": user_id,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
            "type": "access"
        }
        
        if metadata:
            payload.update(metadata)
        
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        logger.info(f"✅ Token créé pour user_id={user_id}")
        return token
    
    @staticmethod
    def decode_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Décoder et valider un token JWT
        
        Args:
            token: Token JWT à valider
        
        Returns:
            Payload décodé si valide, None sinon
        """
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            logger.debug(f"✅ Token valide pour user_id={payload.get('user_id')}")
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("⏰ Token expiré")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"❌ Token invalide: {str(e)}")
            return None
    
    @staticmethod
    def extract_user_id_from_token(token: str) -> Optional[str]:
        """
        Extraire user_id d'un token JWT
        
        Args:
            token: Token JWT
        
        Returns:
            user_id si valide, None sinon
        """
        payload = JWTManager.decode_token(token)
        if payload:
            return payload.get("user_id")
        return None


async def extract_user_from_request(request: Request) -> str:
    """
    Extraire l'ID utilisateur d'une requête HTTP
    
    Vérifie le header Authorization: Bearer <token>
    
    Args:
        request: Objet requête FastAPI
    
    Returns:
        user_id si authentifié, sinon lève HTTPException 401
    
    Raises:
        HTTPException: 401 si token manquant ou invalide
    """
    auth_header = request.headers.get("Authorization")
    
    if not auth_header:
        logger.warning("❌ Requête sans header Authorization")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Format: "Bearer <token>"
    try:
        scheme, token = auth_header.split()
        if scheme.lower() != "bearer":
            raise ValueError("Invalid auth scheme")
    except ValueError:
        logger.warning(f"❌ Format Authorization invalide: {auth_header}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Décoder le token
    user_id = JWTManager.extract_user_id_from_token(token)
    
    if not user_id:
        logger.warning(f"❌ Token invalide ou expiré")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.info(f"✅ Requête authentifiée pour user_id={user_id}")
    return user_id


def require_auth(func):
    """
    Décorateur pour exiger l'authentification JWT sur un endpoint
    
    Usage:
        @app.post("/api/protected")
        @require_auth
        async def protected_endpoint(request: Request):
            user_id = await extract_user_from_request(request)
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Logique d'auth gérée dans l'endpoint
        return await func(*args, **kwargs)
    return wrapper
