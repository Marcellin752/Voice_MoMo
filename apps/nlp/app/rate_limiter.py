"""
🛡️ Rate Limiting Middleware pour VoiceMomo
Protection contre les abus et DDOS
"""

import os
import time
import logging
from typing import Dict, Tuple
from functools import wraps
from fastapi import Request, status
from fastapi.responses import JSONResponse
from collections import defaultdict

logger = logging.getLogger(__name__)

# Configuration
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
RATE_LIMIT_USER_PER_MINUTE = int(os.getenv("RATE_LIMIT_USER_PER_MINUTE", "30"))


class RateLimiter:
    """Rate limiter avec gestion par IP et par user"""
    
    def __init__(self):
        # Structure: {key: [(timestamp, 1), (timestamp, 1), ...]}
        self.ip_requests: Dict[str, list] = defaultdict(list)
        self.user_requests: Dict[str, list] = defaultdict(list)
        self.cleanup_interval = 60  # secondes
        self.last_cleanup = time.time()
    
    def get_client_ip(self, request: Request) -> str:
        """Extraire l'IP du client"""
        # D'abord check X-Forwarded-For (proxy)
        if "X-Forwarded-For" in request.headers:
            return request.headers["X-Forwarded-For"].split(",")[0].strip()
        
        # Sinon utiliser client.host
        return request.client.host if request.client else "unknown"
    
    def _cleanup_old_requests(self):
        """Nettoyer les requêtes + vieilles que 1 minute"""
        current_time = time.time()
        
        # Cleanup tous les 60 secondes seulement (perf)
        if current_time - self.last_cleanup < self.cleanup_interval:
            return
        
        cutoff = current_time - 60
        
        # Nettoyer par IP
        for ip in list(self.ip_requests.keys()):
            self.ip_requests[ip] = [
                (ts, 1) for ts, _ in self.ip_requests[ip] if ts > cutoff
            ]
            if not self.ip_requests[ip]:
                del self.ip_requests[ip]
        
        # Nettoyer par user
        for user_id in list(self.user_requests.keys()):
            self.user_requests[user_id] = [
                (ts, 1) for ts, _ in self.user_requests[user_id] if ts > cutoff
            ]
            if not self.user_requests[user_id]:
                del self.user_requests[user_id]
        
        self.last_cleanup = current_time
    
    def is_rate_limited_by_ip(self, client_ip: str) -> Tuple[bool, Dict]:
        """Vérifier rate limit par IP"""
        self._cleanup_old_requests()
        
        current_time = time.time()
        cutoff = current_time - 60
        
        # Compter les requêtes dans la dernière minute
        recent_requests = [
            (ts, 1) for ts, _ in self.ip_requests[client_ip] if ts > cutoff
        ]
        
        self.ip_requests[client_ip] = recent_requests
        count = len(recent_requests)
        
        is_limited = count >= RATE_LIMIT_PER_MINUTE
        
        return is_limited, {
            "limit": RATE_LIMIT_PER_MINUTE,
            "current": count,
            "remaining": max(0, RATE_LIMIT_PER_MINUTE - count),
            "reset_in_seconds": 60
        }
    
    def is_rate_limited_by_user(self, user_id: str) -> Tuple[bool, Dict]:
        """Vérifier rate limit par user"""
        self._cleanup_old_requests()
        
        current_time = time.time()
        cutoff = current_time - 60
        
        # Compter les requêtes dans la dernière minute
        recent_requests = [
            (ts, 1) for ts, _ in self.user_requests[user_id] if ts > cutoff
        ]
        
        self.user_requests[user_id] = recent_requests
        count = len(recent_requests)
        
        is_limited = count >= RATE_LIMIT_USER_PER_MINUTE
        
        return is_limited, {
            "limit": RATE_LIMIT_USER_PER_MINUTE,
            "current": count,
            "remaining": max(0, RATE_LIMIT_USER_PER_MINUTE - count),
            "reset_in_seconds": 60
        }
    
    def record_request(self, client_ip: str, user_id: str = None):
        """Enregistrer une requête"""
        current_time = time.time()
        
        # Enregistrer par IP
        self.ip_requests[client_ip].append((current_time, 1))
        
        # Enregistrer par user si disponible
        if user_id:
            self.user_requests[user_id].append((current_time, 1))


# Singleton global
_limiter = RateLimiter()

def get_rate_limiter():
    return _limiter


async def rate_limit_middleware(request: Request, call_next):
    """Middleware de rate limiting"""
    
    limiter = get_rate_limiter()
    client_ip = limiter.get_client_ip(request)
    
    # Vérifier rate limit par IP
    is_limited_ip, ip_stats = limiter.is_rate_limited_by_ip(client_ip)
    
    if is_limited_ip:
        logger.warning(f"🚫 Rate limit exceeded for IP {client_ip}")
        # Note: BaseHTTPMiddleware n'intercepte pas les HTTPException levées ici
        # (elles remonteraient comme une erreur 500 non gérée) — on doit renvoyer
        # directement la réponse.
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Too many requests"},
            headers={
                "Retry-After": "60",
                "X-RateLimit-Limit": str(RATE_LIMIT_PER_MINUTE),
                "X-RateLimit-Remaining": str(ip_stats["remaining"]),
            }
        )
    
    # Extraire user_id si disponible
    user_id = None
    auth_header = request.headers.get("Authorization", "")
    
    if auth_header.startswith("Bearer "):
        try:
            from app.auth import JWTManager
            token = auth_header.split(" ")[1]
            user_id = JWTManager.extract_user_id_from_token(token)
        except:
            pass
    
    # Vérifier rate limit par user
    if user_id:
        is_limited_user, user_stats = limiter.is_rate_limited_by_user(user_id)
        
        if is_limited_user:
            logger.warning(f"🚫 Rate limit exceeded for user {user_id}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "User rate limit exceeded"},
                headers={
                    "Retry-After": "60",
                    "X-RateLimit-Limit": str(RATE_LIMIT_USER_PER_MINUTE),
                    "X-RateLimit-Remaining": str(user_stats["remaining"]),
                }
            )
    
    # Enregistrer la requête
    limiter.record_request(client_ip, user_id)
    
    # Ajouter les stats aux headers de réponse
    response = await call_next(request)
    
    is_limited, stats = limiter.is_rate_limited_by_ip(client_ip)
    response.headers["X-RateLimit-Limit"] = str(stats["limit"])
    response.headers["X-RateLimit-Remaining"] = str(stats["remaining"])
    response.headers["X-RateLimit-Reset"] = str(int(time.time()) + stats["reset_in_seconds"])
    
    return response


def rate_limit_endpoint(limit_per_minute: int = None):
    """Décorateur pour rate-limiter un endpoint spécifique"""
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            limiter = get_rate_limiter()
            
            # Vérifier le limit custom si fourni
            if limit_per_minute:
                client_ip = limiter.get_client_ip(request)
                # Implementation custom limit ici si besoin
            
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator
