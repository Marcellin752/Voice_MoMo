"""
Gestionnaire de cache en mémoire pour transactions en attente de confirmation
Thread-safe avec TTL (Time-To-Live)
"""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
from dataclasses import dataclass, field
import threading

logger = logging.getLogger(__name__)


@dataclass
class PendingTransaction:
    """Transaction en attente de confirmation"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    intent: str = ""
    amount: Optional[float] = None
    recipient: Optional[str] = None
    service_type: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    ttl: int = 300  # 5 minutes par défaut
    
    def is_expired(self) -> bool:
        """Vérifier si la transaction a expiré"""
        return datetime.now() > self.created_at + timedelta(seconds=self.ttl)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convertir en dictionnaire"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "intent": self.intent,
            "amount": self.amount,
            "recipient": self.recipient,
            "service_type": self.service_type,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "expires_at": (self.created_at + timedelta(seconds=self.ttl)).isoformat(),
        }


class TransactionCache:
    """Cache thread-safe pour transactions en attente"""
    
    def __init__(self):
        self._cache: Dict[str, PendingTransaction] = {}
        self._user_to_tx: Dict[str, str] = {}  # Mapping user_id → transaction_id
        self._lock = threading.RLock()
    
    def add(
        self,
        user_id: Optional[str],
        intent: str,
        amount: Optional[float] = None,
        recipient: Optional[str] = None,
        service_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ttl: int = 300
    ) -> str:
        """
        Ajouter une transaction en cache
        
        Returns:
            ID de la transaction
        """
        with self._lock:
            tx = PendingTransaction(
                user_id=user_id,
                intent=intent,
                amount=amount,
                recipient=recipient,
                service_type=service_type,
                metadata=metadata or {},
                ttl=ttl
            )
            
            # Remplacer l'ancienne transaction du même user (une seule en attente)
            if user_id and user_id in self._user_to_tx:
                old_tx_id = self._user_to_tx[user_id]
                del self._cache[old_tx_id]
                logger.info(f"🗑️ Ancienne transaction remplacée: {old_tx_id}")
            
            self._cache[tx.id] = tx
            if user_id:
                self._user_to_tx[user_id] = tx.id
            
            logger.info(f"✅ Transaction en cache: {tx.id} (user: {user_id})")
            return tx.id
    
    def get_by_id(self, transaction_id: str) -> Optional[PendingTransaction]:
        """Récupérer une transaction par son ID"""
        with self._lock:
            if transaction_id not in self._cache:
                return None
            
            tx = self._cache[transaction_id]
            if tx.is_expired():
                del self._cache[transaction_id]
                logger.warning(f"⏰ Transaction expirée: {transaction_id}")
                return None
            
            return tx
    
    def get_by_user(self, user_id: str) -> Optional[PendingTransaction]:
        """Récupérer la transaction en attente d'un utilisateur"""
        with self._lock:
            if user_id not in self._user_to_tx:
                return None
            
            transaction_id = self._user_to_tx[user_id]
            return self.get_by_id(transaction_id)
    
    def confirm(self, transaction_id: str) -> Optional[PendingTransaction]:
        """Confirmer et retirer une transaction du cache"""
        with self._lock:
            tx = self.get_by_id(transaction_id)
            if not tx:
                return None
            
            # Retirer du cache
            del self._cache[transaction_id]
            if tx.user_id in self._user_to_tx:
                del self._user_to_tx[tx.user_id]
            
            logger.info(f"✅ Transaction confirmée et retirée: {transaction_id}")
            return tx
    
    def cancel(self, transaction_id: str) -> Optional[PendingTransaction]:
        """Annuler et retirer une transaction du cache"""
        with self._lock:
            tx = self.get_by_id(transaction_id)
            if not tx:
                return None
            
            # Retirer du cache
            del self._cache[transaction_id]
            if tx.user_id in self._user_to_tx:
                del self._user_to_tx[tx.user_id]
            
            logger.info(f"❌ Transaction annulée: {transaction_id}")
            return tx
    
    def cleanup_expired(self) -> int:
        """Nettoyer les transactions expirées"""
        with self._lock:
            expired = [
                tx_id for tx_id, tx in self._cache.items()
                if tx.is_expired()
            ]
            
            for tx_id in expired:
                tx = self._cache[tx_id]
                del self._cache[tx_id]
                if tx.user_id in self._user_to_tx:
                    del self._user_to_tx[tx.user_id]
            
            if expired:
                logger.info(f"🧹 Nettoyage: {len(expired)} transactions expirées")
            
            return len(expired)
    
    def list_all(self) -> list[PendingTransaction]:
        """Lister toutes les transactions non-expirées"""
        with self._lock:
            return [
                tx for tx in self._cache.values()
                if not tx.is_expired()
            ]
    
    def size(self) -> int:
        """Nombre de transactions en cache"""
        with self._lock:
            return len(self._cache)


# Instance globale du cache
_transaction_cache = TransactionCache()


def get_transaction_cache() -> TransactionCache:
    """Obtenir l'instance globale du cache"""
    return _transaction_cache
