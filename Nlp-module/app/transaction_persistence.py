"""
💾 Couche de persistence pour les transactions en attente
Supporte: In-memory (dev) + PostgreSQL (prod)
"""

import os
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


class TransactionPersistence:
    """Interface de persistence abstraite"""
    
    async def save(self, transaction_id: str, data: dict) -> bool:
        """Sauvegarder une transaction"""
        raise NotImplementedError
    
    async def get(self, transaction_id: str) -> Optional[dict]:
        """Récupérer une transaction"""
        raise NotImplementedError
    
    async def delete(self, transaction_id: str) -> bool:
        """Supprimer une transaction"""
        raise NotImplementedError
    
    async def get_by_user(self, user_id: str) -> Optional[dict]:
        """Récupérer les transactions d'un utilisateur"""
        raise NotImplementedError


class PostgresTransactionPersistence(TransactionPersistence):
    """Persistence PostgreSQL pour les transactions"""
    
    def __init__(self):
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            self.psycopg2 = psycopg2
            self.RealDictCursor = RealDictCursor
            self.conn = None
            self.initialized = False
        except ImportError:
            logger.error("❌ psycopg2 not installed. Install with: pip install psycopg2-binary")
            self.initialized = False
    
    async def connect(self):
        """Établir la connexion PostgreSQL"""
        if self.initialized or not hasattr(self, 'psycopg2'):
            return
        
        try:
            db_url = os.getenv(
                "DATABASE_URL",
                "postgresql://postgres:password@localhost:5432/voice_momo"
            )
            
            self.conn = self.psycopg2.connect(db_url)
            self._init_db()
            self.initialized = True
            logger.info("✅ PostgreSQL connection established")
            
        except Exception as e:
            logger.error(f"❌ PostgreSQL connection failed: {e}")
            self.initialized = False
    
    def _init_db(self):
        """Initialiser la schema si nécessaire"""
        if not self.conn:
            return
        
        cursor = self.conn.cursor()
        
        try:
            # Créer la table s'il n'existe pas
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pending_transactions (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    intent VARCHAR(50) NOT NULL,
                    amount DECIMAL(10, 2),
                    recipient VARCHAR(255),
                    service_type VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    ttl INTEGER DEFAULT 300,
                    metadata JSONB,
                    INDEX idx_user_id (user_id),
                    INDEX idx_expires_at (expires_at)
                );
            """)
            self.conn.commit()
            logger.info("✅ Database schema initialized")
            
        except Exception as e:
            logger.warning(f"⚠️ Schema init: {e}")
            self.conn.rollback()
        finally:
            cursor.close()
    
    async def save(self, transaction_id: str, data: dict) -> bool:
        """Sauvegarder une transaction"""
        if not self.conn:
            return False
        
        try:
            cursor = self.conn.cursor()
            
            cursor.execute("""
                INSERT INTO pending_transactions 
                (id, user_id, intent, amount, recipient, service_type, expires_at, ttl, metadata)
                VALUES (%(id)s, %(user_id)s, %(intent)s, %(amount)s, %(recipient)s, 
                        %(service_type)s, %(expires_at)s, %(ttl)s, %(metadata)s)
                ON CONFLICT (id) DO UPDATE SET
                    expires_at = EXCLUDED.expires_at,
                    metadata = EXCLUDED.metadata;
            """, {
                'id': transaction_id,
                'user_id': data.get('user_id'),
                'intent': data.get('intent'),
                'amount': data.get('amount'),
                'recipient': data.get('recipient'),
                'service_type': data.get('service_type'),
                'expires_at': data.get('expires_at'),
                'ttl': data.get('ttl', 300),
                'metadata': data.get('metadata', {}),
            })
            
            self.conn.commit()
            logger.info(f"✅ Transaction saved: {transaction_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Save transaction failed: {e}")
            self.conn.rollback()
            return False
        finally:
            cursor.close()
    
    async def get(self, transaction_id: str) -> Optional[dict]:
        """Récupérer une transaction"""
        if not self.conn:
            return None
        
        try:
            cursor = self.conn.cursor(cursor_factory=self.RealDictCursor)
            
            cursor.execute("""
                SELECT * FROM pending_transactions 
                WHERE id = %s AND expires_at > NOW()
            """, (transaction_id,))
            
            result = cursor.fetchone()
            return dict(result) if result else None
            
        except Exception as e:
            logger.error(f"❌ Get transaction failed: {e}")
            return None
        finally:
            cursor.close()
    
    async def delete(self, transaction_id: str) -> bool:
        """Supprimer une transaction"""
        if not self.conn:
            return False
        
        try:
            cursor = self.conn.cursor()
            
            cursor.execute(
                "DELETE FROM pending_transactions WHERE id = %s",
                (transaction_id,)
            )
            
            self.conn.commit()
            logger.info(f"✅ Transaction deleted: {transaction_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Delete transaction failed: {e}")
            self.conn.rollback()
            return False
        finally:
            cursor.close()
    
    async def get_by_user(self, user_id: str) -> Optional[dict]:
        """Récupérer les transactions d'un utilisateur"""
        if not self.conn:
            return None
        
        try:
            cursor = self.conn.cursor(cursor_factory=self.RealDictCursor)
            
            cursor.execute("""
                SELECT * FROM pending_transactions 
                WHERE user_id = %s AND expires_at > NOW()
                LIMIT 1
            """, (user_id,))
            
            result = cursor.fetchone()
            return dict(result) if result else None
            
        except Exception as e:
            logger.error(f"❌ Get by user failed: {e}")
            return None
        finally:
            cursor.close()
    
    async def cleanup_expired(self):
        """Supprimer les transactions expirées"""
        if not self.conn:
            return
        
        try:
            cursor = self.conn.cursor()
            
            cursor.execute(
                "DELETE FROM pending_transactions WHERE expires_at < NOW()"
            )
            
            deleted = cursor.rowcount
            self.conn.commit()
            
            if deleted > 0:
                logger.info(f"🧹 Cleaned {deleted} expired transactions")
            
        except Exception as e:
            logger.error(f"❌ Cleanup failed: {e}")
            self.conn.rollback()
        finally:
            cursor.close()


class InMemoryTransactionPersistence(TransactionPersistence):
    """Persistence in-memory (développement)"""
    
    def __init__(self):
        self.storage: dict = {}
        logger.info("💾 Using in-memory transaction storage (dev mode)")
    
    async def save(self, transaction_id: str, data: dict) -> bool:
        self.storage[transaction_id] = data
        return True
    
    async def get(self, transaction_id: str) -> Optional[dict]:
        return self.storage.get(transaction_id)
    
    async def delete(self, transaction_id: str) -> bool:
        if transaction_id in self.storage:
            del self.storage[transaction_id]
            return True
        return False
    
    async def get_by_user(self, user_id: str) -> Optional[dict]:
        for tx_id, tx_data in self.storage.items():
            if tx_data.get('user_id') == user_id:
                return tx_data
        return None
    
    async def cleanup_expired(self):
        now = datetime.now()
        expired_ids = [
            tx_id for tx_id, tx_data in self.storage.items()
            if tx_data.get('expires_at') and tx_data['expires_at'] < now
        ]
        for tx_id in expired_ids:
            del self.storage[tx_id]


def get_persistence() -> TransactionPersistence:
    """Factory: Retourner le bon type de persistence selon l'env"""
    use_postgres = os.getenv("USE_POSTGRES", "false").lower() == "true"
    
    if use_postgres:
        return PostgresTransactionPersistence()
    else:
        return InMemoryTransactionPersistence()
