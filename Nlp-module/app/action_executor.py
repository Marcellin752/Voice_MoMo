"""
Exécuteur d'actions pour Mobile Money
Gère: balance, transfer, recharge, bill_payment, etc.
"""

import logging
from typing import Dict, Any, Optional
from enum import Enum
from app.transaction_cache import get_transaction_cache, PendingTransaction
from app.models import Intent

logger = logging.getLogger(__name__)


class ActionResult:
    """Résultat de l'exécution d'une action"""
    
    def __init__(
        self,
        success: bool,
        intent: str,
        message: str,
        requires_confirmation: bool = False,
        transaction_id: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None
    ):
        self.success = success
        self.intent = intent
        self.message = message
        self.requires_confirmation = requires_confirmation
        self.transaction_id = transaction_id
        self.data = data or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convertir en dictionnaire pour la réponse API"""
        return {
            "success": self.success,
            "intent": self.intent,
            "message": self.message,
            "requires_confirmation": self.requires_confirmation,
            "transaction_id": self.transaction_id,
            "data": self.data
        }


class ActionExecutor:
    """Exécuteur d'actions Mobile Money"""
    
    def __init__(self):
        self.cache = get_transaction_cache()
        # Simuler une base de données utilisateur
        self.users_db = {
            "default": {
                "balance": 50000,
                "phone": "+221771234567",
                "name": "User",
            }
        }
    
    def execute(
        self,
        user_id: str,
        intent: Intent,
        amount: Optional[float] = None,
        recipient: Optional[str] = None,
        service_type: Optional[str] = None,
        needs_confirmation: bool = False,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ActionResult:
        """
        Exécuter une action selon l'intent
        """
        logger.info(f"🚀 Exécution action: {intent.value} (confirmation: {needs_confirmation})")
        
        # Route vers le bon handler
        if intent == Intent.BALANCE:
            return self._handle_balance(user_id)
        
        elif intent == Intent.TRANSFER:
            return self._handle_transfer(
                user_id, amount, recipient, needs_confirmation
            )
        
        elif intent == Intent.RECHARGE:
            return self._handle_recharge(
                user_id, amount, needs_confirmation
            )
        
        elif intent == Intent.BILL_PAYMENT:
            return self._handle_bill_payment(
                user_id, amount, service_type, needs_confirmation
            )
        
        elif intent == Intent.HELP:
            return self._handle_help()
        
        else:
            return ActionResult(
                success=False,
                intent=intent.value,
                message=f"Action non supportée: {intent.value}"
            )
    
    def confirm_action(self, transaction_id: str, user_id: str) -> ActionResult:
        """
        Confirmer une action en attente
        """
        logger.info(f"✅ Confirmation transaction: {transaction_id}")
        
        # Récupérer la transaction du cache
        tx = self.cache.get_by_id(transaction_id)
        if not tx:
            return ActionResult(
                success=False,
                intent="confirm",
                message="Transaction pas trouvée ou expirée"
            )
        
        # Vérifier que c'est le bon utilisateur
        if tx.user_id != user_id:
            logger.warning(f"⚠️ Tentative de confirmer la transaction d'un autre user")
            return ActionResult(
                success=False,
                intent="confirm",
                message="Accès non autorisé"
            )
        
        # Exécuter l'action confirmée
        if tx.intent == "transfer":
            return self._execute_transfer(
                user_id, tx.amount, tx.recipient, transaction_id
            )
        
        elif tx.intent == "recharge":
            return self._execute_recharge(
                user_id, tx.amount, transaction_id
            )
        
        elif tx.intent == "bill_payment":
            return self._execute_bill_payment(
                user_id, tx.amount, tx.service_type, transaction_id
            )
        
        else:
            return ActionResult(
                success=False,
                intent="confirm",
                message=f"Type de transaction inconnu: {tx.intent}"
            )
    
    def cancel_action(self, transaction_id: str, user_id: str) -> ActionResult:
        """
        Annuler une action en attente
        """
        logger.info(f"❌ Annulation transaction: {transaction_id}")
        
        tx = self.cache.cancel(transaction_id)
        if not tx:
            return ActionResult(
                success=False,
                intent="cancel",
                message="Transaction pas trouvée ou expirée"
            )
        
        return ActionResult(
            success=True,
            intent="cancel",
            message=f"Action annulée: {tx.intent}"
        )
    
    # ========================================================================
    # HANDLERS D'ACTIONS
    # ========================================================================
    
    def _handle_balance(self, user_id: str) -> ActionResult:
        """Consulter le solde"""
        logger.info(f"💰 Vérification solde pour: {user_id}")
        
        user = self.users_db.get(user_id) or self.users_db["default"]
        balance = user.get("balance", 0)
        
        message = f"Votre solde actuel est de {balance:,.0f} francs CFA."
        
        return ActionResult(
            success=True,
            intent=Intent.BALANCE.value,
            message=message,
            data={"balance": balance}
        )
    
    def _handle_transfer(
        self,
        user_id: str,
        amount: Optional[float],
        recipient: Optional[str],
        needs_confirmation: bool
    ) -> ActionResult:
        """Initier un transfert d'argent"""
        logger.info(f"💸 Transfert: {amount} XOF → {recipient}")
        
        # Validation
        if not amount or amount <= 0:
            return ActionResult(
                success=False,
                intent=Intent.TRANSFER.value,
                message="Montant invalide"
            )
        
        if not recipient:
            return ActionResult(
                success=False,
                intent=Intent.TRANSFER.value,
                message="Destinataire non spécifié"
            )
        
        user = self.users_db.get(user_id) or self.users_db["default"]
        balance = user.get("balance", 0)
        
        # Vérifier les fonds
        if balance < amount:
            return ActionResult(
                success=False,
                intent=Intent.TRANSFER.value,
                message=f"Solde insuffisant. Solde actuel: {balance:,.0f} XOF"
            )
        
        if needs_confirmation:
            # Mettre en cache la transaction en attente de confirmation
            tx_id = self.cache.add(
                user_id=user_id,
                intent="transfer",
                amount=amount,
                recipient=recipient,
                ttl=300  # 5 min
            )
            
            message = f"Voulez-vous envoyer {amount:,.0f} francs CFA à {recipient}?"
            
            return ActionResult(
                success=True,
                intent=Intent.TRANSFER.value,
                message=message,
                requires_confirmation=True,
                transaction_id=tx_id
            )
        else:
            # Exécuter directement
            return self._execute_transfer(user_id, amount, recipient)
    
    def _execute_transfer(
        self,
        user_id: str,
        amount: float,
        recipient: str,
        transaction_id: Optional[str] = None
    ) -> ActionResult:
        """Exécuter le transfert"""
        logger.info(f"✅ Exécution transfert: {amount} XOF → {recipient}")
        
        user = self.users_db.get(user_id) or self.users_db["default"]
        
        # Débiter le compte
        user["balance"] = user.get("balance", 0) - amount
        
        # Retirer du cache si confirmé
        if transaction_id:
            self.cache.confirm(transaction_id)
        
        message = f"Transfert de {amount:,.0f} francs CFA à {recipient} réussi."
        
        return ActionResult(
            success=True,
            intent=Intent.TRANSFER.value,
            message=message,
            transaction_id=transaction_id,
            data={"amount": amount, "recipient": recipient}
        )
    
    def _handle_recharge(
        self,
        user_id: str,
        amount: Optional[float],
        needs_confirmation: bool
    ) -> ActionResult:
        """Initier une recharge crédit téléphonique"""
        logger.info(f"📱 Recharge crédit: {amount} XOF")
        
        # Validation
        if not amount or amount <= 0:
            return ActionResult(
                success=False,
                intent=Intent.RECHARGE.value,
                message="Montant invalide pour recharge"
            )
        
        if needs_confirmation:
            tx_id = self.cache.add(
                user_id=user_id,
                intent="recharge",
                amount=amount,
                ttl=300
            )
            
            message = f"Voulez-vous acheter {amount:,.0f} francs CFA de crédit?"
            
            return ActionResult(
                success=True,
                intent=Intent.RECHARGE.value,
                message=message,
                requires_confirmation=True,
                transaction_id=tx_id
            )
        else:
            return self._execute_recharge(user_id, amount)
    
    def _execute_recharge(
        self,
        user_id: str,
        amount: float,
        transaction_id: Optional[str] = None
    ) -> ActionResult:
        """Exécuter la recharge"""
        logger.info(f"✅ Exécution recharge: {amount} XOF")
        
        user = self.users_db.get(user_id) or self.users_db["default"]
        user["balance"] = user.get("balance", 0) - amount
        
        if transaction_id:
            self.cache.confirm(transaction_id)
        
        message = f"Recharge de {amount:,.0f} francs CFA effectuée sur votre téléphone."
        
        return ActionResult(
            success=True,
            intent=Intent.RECHARGE.value,
            message=message,
            transaction_id=transaction_id,
            data={"amount": amount}
        )
    
    def _handle_bill_payment(
        self,
        user_id: str,
        amount: Optional[float],
        service_type: Optional[str],
        needs_confirmation: bool
    ) -> ActionResult:
        """Initier le paiement d'une facture"""
        logger.info(f"💡 Paiement facture: {service_type} - {amount} XOF")
        
        # Validation
        if not amount or amount <= 0:
            return ActionResult(
                success=False,
                intent=Intent.BILL_PAYMENT.value,
                message="Montant invalide"
            )
        
        if not service_type:
            return ActionResult(
                success=False,
                intent=Intent.BILL_PAYMENT.value,
                message="Type de facture non spécifié"
            )
        
        if needs_confirmation:
            tx_id = self.cache.add(
                user_id=user_id,
                intent="bill_payment",
                amount=amount,
                service_type=service_type,
                ttl=300
            )
            
            message = f"Voulez-vous payer votre {service_type} pour {amount:,.0f} francs CFA?"
            
            return ActionResult(
                success=True,
                intent=Intent.BILL_PAYMENT.value,
                message=message,
                requires_confirmation=True,
                transaction_id=tx_id
            )
        else:
            return self._execute_bill_payment(user_id, amount, service_type)
    
    def _execute_bill_payment(
        self,
        user_id: str,
        amount: float,
        service_type: str,
        transaction_id: Optional[str] = None
    ) -> ActionResult:
        """Exécuter le paiement de facture"""
        logger.info(f"✅ Exécution paiement facture: {service_type}")
        
        user = self.users_db.get(user_id) or self.users_db["default"]
        user["balance"] = user.get("balance", 0) - amount
        
        if transaction_id:
            self.cache.confirm(transaction_id)
        
        message = f"Paiement de votre {service_type} ({amount:,.0f} XOF) accepté."
        
        return ActionResult(
            success=True,
            intent=Intent.BILL_PAYMENT.value,
            message=message,
            transaction_id=transaction_id,
            data={"amount": amount, "service": service_type}
        )
    
    def _handle_help(self) -> ActionResult:
        """Afficher l'aide"""
        message = """Je peux vous aider avec:
        
💰 Solde: "Quel est mon solde?"
💸 Transfert: "Envoie 5000 à Jean"
📱 Recharge: "Recharge 1000"
💡 Factures: "Paye ma facture d'électricité pour 25000"

Dites toujours les montants en francs CFA."""
        
        return ActionResult(
            success=True,
            intent=Intent.HELP.value,
            message=message
        )


# Instance globale
_action_executor = None


def get_action_executor() -> ActionExecutor:
    """Obtenir l'exécuteur d'actions global"""
    global _action_executor
    if _action_executor is None:
        _action_executor = ActionExecutor()
    return _action_executor
