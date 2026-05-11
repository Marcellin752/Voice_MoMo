"""
Exécuteur d'actions pour Mobile Money
Gère: balance, transfer, recharge, bill_payment, etc.
"""

import logging
import re
from typing import Dict, Any, Optional
from app.transaction_cache import get_transaction_cache
from app.entity_normalizer import format_amount_for_tts, format_recipient_for_tts
from app.models import Intent
from app.backend_actions import get_backend_client

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


import os as _os

# Mapping intent NLP → action TypeScript backend + params fixes
_INTENT_TO_TS: dict = {
    Intent.BALANCE:           ("balance",     {}),
    Intent.TRANSFER:          ("transfer",    None),
    Intent.DEPOSIT:           ("transfer",    None),
    Intent.WITHDRAW:          ("withdraw",    {}),
    Intent.WITHDRAW_GAB:      ("withdraw",    {"gab": True}),
    Intent.RECHARGE:          ("airtime",     {}),
    Intent.INTERNET_DAY:      ("airtime",     {"airtimeType": "internet-jour"}),
    Intent.INTERNET_WEEK:     ("airtime",     {"airtimeType": "internet-semaine"}),
    Intent.INTERNET_MONTH:    ("airtime",     {"airtimeType": "internet-mois"}),
    Intent.INTERNET_UNLIMITED:("airtime",     {"airtimeType": "internet-illimite"}),
    Intent.GOPACK_DAY:        ("airtime",     {"airtimeType": "gopack-jour"}),
    Intent.GOPACK_WEEK:       ("airtime",     {"airtimeType": "gopack-semaine"}),
    Intent.GOPACK_MONTH:      ("airtime",     {"airtimeType": "gopack-mois"}),
    Intent.BILL_PAYMENT:      ("billPayment", None),
}


class ActionExecutor:
    """Exécuteur d'actions Mobile Money"""

    def __init__(self):
        self.cache = get_transaction_cache()
        self.backend = get_backend_client()
        self.default_country = _os.getenv("DEFAULT_COUNTRY", "BJ")
        # Balance simulée (utilisée uniquement si BACKEND_ACTION_URL non configuré)
        self.users_db = {
            "default": {
                "balance": 50000,
                "phone": "+22997000000",
                "name": "Utilisateur",
            }
        }

    @staticmethod
    def _normalized_amount(amount: Optional[float]) -> Optional[int]:
        if amount is None:
            return None

        try:
            value = int(float(amount))
        except (TypeError, ValueError):
            return None

        return value if value > 0 else None

    @staticmethod
    def _normalized_recipient(recipient: Optional[str]) -> Optional[str]:
        if not recipient:
            return None
        cleaned = recipient.strip()
        
        # Résolution simple de contacts pour la démo / production
        contacts_mock = {
            "maman": "0022961000001",
            "papa": "0022961000002",
            "jean": "0022961000003",
            "aurel": "0022961000004",
        }
        if cleaned.lower() in contacts_mock:
            return contacts_mock[cleaned.lower()]
            
        digits = re.sub(r"\D", "", cleaned)
        if 8 <= len(digits) <= 15:
            return digits
        return cleaned

    def _execute_via_backend(
        self,
        intent: Intent,
        amount: Optional[float],
        recipient: Optional[str],
        service_type: Optional[str],
        transaction_id: Optional[str] = None,
    ) -> Optional["ActionResult"]:
        """
        Appelle le TypeScript backend pour exécuter l'action via USSD (mock ou réel).
        Retourne None si le backend n'est pas disponible ou échoue.
        """
        if not self.backend.available:
            return None

        mapping = _INTENT_TO_TS.get(intent)
        if mapping is None:
            return None

        ts_action, fixed_params = mapping
        params: Dict[str, Any] = dict(fixed_params or {})

        if amount is not None:
            params["amount"] = int(amount)
        if recipient:
            params["to"] = recipient
        if service_type:
            params["ref"] = service_type

        try:
            result = self.backend.run(
                action=ts_action,
                country=self.default_country,
                params=params,
            )

            # Mode simulation renvoyé si BACKEND_ACTION_URL absent (double sécurité)
            if result.get("status") == "simulated":
                return None

            if transaction_id:
                self.cache.confirm(transaction_id)

            success = result.get("success", False)
            message = result.get("voiceResponse") or result.get("mtnMessage") or (
                "Transaction réussie." if success else "Transaction échouée."
            )
            return ActionResult(
                success=success,
                intent=intent.value,
                message=message,
                transaction_id=transaction_id,
                data={
                    "mtnMessage": result.get("mtnMessage"),
                    "newBalance": result.get("newBalance"),
                    "amount": amount,
                    "recipient": recipient,
                },
            )
        except Exception as exc:
            logger.warning(f"Backend call failed ({exc}), falling back to simulation")
            return None

    def execute(
        self,
        user_id: str,
        intent: Intent,
        amount: Optional[float] = None,
        recipient: Optional[str] = None,
        service_type: Optional[str] = None,
        needs_confirmation: bool = False,
        metadata: Optional[Dict[str, Any]] = None  # noqa: ARG002
    ) -> ActionResult:
        """
        Exécuter une action selon l'intent
        """
        logger.info(f"🚀 EXECUTE intent={intent.value}, user_id={user_id}")
        logger.info(f"   amount={amount}, recipient={recipient}, service_type={service_type}")
        logger.info(f"   needs_confirmation={needs_confirmation}")
        
        # Route vers le bon handler
        if intent == Intent.BALANCE:
            logger.info(f"   → Handler: BALANCE")
            return self._handle_balance(user_id)
        
        elif intent == Intent.TRANSFER:
            logger.info(f"   → Handler: TRANSFER")
            return self._handle_transfer(
                user_id, amount, recipient, needs_confirmation
            )
        
        elif intent == Intent.DEPOSIT:
            logger.info(f"   → Handler: DEPOSIT")
            return self._handle_deposit(
                user_id, amount, recipient, needs_confirmation
            )
            
        elif intent == Intent.WITHDRAW:
            logger.info(f"   → Handler: WITHDRAW")
            return self._handle_withdraw(user_id, amount, needs_confirmation)
        
        elif intent == Intent.WITHDRAW_GAB:
            logger.info(f"   → Handler: WITHDRAW_GAB")
            return self._handle_airtime(user_id, amount, "gab", needs_confirmation)
        
        elif intent == Intent.RECHARGE:
            logger.info(f"   → Handler: RECHARGE")
            return self._handle_recharge(
                user_id, amount, needs_confirmation
            )
        
        elif intent in {Intent.INTERNET_DAY, Intent.INTERNET_WEEK, Intent.INTERNET_MONTH, Intent.INTERNET_UNLIMITED}:
            logger.info(f"   → Handler: {intent.value}")
            airtime_type = f"internet-{intent.value.split('_')[1]}"
            return self._handle_airtime(user_id, amount, airtime_type, needs_confirmation)
        
        elif intent in {Intent.GOPACK_DAY, Intent.GOPACK_WEEK, Intent.GOPACK_MONTH}:
            logger.info(f"   → Handler: {intent.value}")
            airtime_type = f"gopack-{intent.value.split('_')[1]}"
            return self._handle_airtime(user_id, amount, airtime_type, needs_confirmation)
        
        elif intent == Intent.BILL_PAYMENT:
            logger.info(f"   → Handler: BILL_PAYMENT")
            return self._handle_bill_payment(
                user_id, amount, service_type, needs_confirmation
            )
        
        elif intent == Intent.HELP:
            logger.info(f"   → Handler: HELP")
            return self._handle_help()
        
        else:
            logger.error(f"   ❌ Intent non supporté: {intent.value}")
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
            return self._execute_transfer(user_id, tx.amount, tx.recipient, transaction_id)
        elif tx.intent == "deposit":
            return self._execute_deposit(user_id, tx.amount, tx.recipient, transaction_id)
        elif tx.intent == "withdraw":
            return self._execute_withdraw(user_id, tx.amount, transaction_id)
        elif tx.intent in {"withdraw_gab", "internet_day", "internet_week", "internet_month",
                           "internet_unlimited", "gopack_day", "gopack_week", "gopack_month"}:
            return self._execute_airtime(user_id, tx.amount, tx.service_type, transaction_id)
        elif tx.intent == "recharge":
            return self._execute_recharge(user_id, tx.amount, transaction_id)
        elif tx.intent == "bill_payment":
            return self._execute_bill_payment(user_id, tx.amount, tx.service_type, transaction_id)
        
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
        logger.info(f"❌ CANCEL transaction_id={transaction_id}, user_id={user_id}")
        
        tx = self.cache.cancel(transaction_id)
        logger.info(f"   Transaction annulée: {tx is not None}")
        
        if not tx:
            logger.error(f"   ❌ Transaction introuvable ou expirée")
            return ActionResult(
                success=False,
                intent="cancel",
                message="Transaction pas trouvée ou expirée"
            )
        
        logger.info(f"   ✅ Action annulée: {tx.intent}")
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
        logger.info(f"💰 BALANCE CHECK pour user_id={user_id}")
        
        user = self.users_db.get(user_id)
        logger.info(f"   User trouvé: {user is not None}")
        
        if not user:
            logger.info(f"   → Fallback à user par défaut")
            user = self.users_db["default"]
        
        balance = user.get("balance", 0)
        logger.info(f"   ✅ Balance: {format_amount_for_tts(balance)} XOF")
        
        message = f"Votre solde actuel est de {format_amount_for_tts(balance)} francs CFA."
        
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
        amount_value = self._normalized_amount(amount)
        recipient_value = self._normalized_recipient(recipient)

        logger.info(f"💸 Transfert: {amount_value} XOF → {recipient_value}")
        
        # Validation
        if amount_value is None:
            return ActionResult(
                success=False,
                intent=Intent.TRANSFER.value,
                message="Montant invalide"
            )
        
        if not recipient_value:
            return ActionResult(
                success=False,
                intent=Intent.TRANSFER.value,
                message="Destinataire non spécifié"
            )
        
        user = self.users_db.get(user_id) or self.users_db["default"]
        balance = user.get("balance", 0)
        
        # Vérifier les fonds
        if balance < amount_value:
            return ActionResult(
                success=False,
                intent=Intent.TRANSFER.value,
                message=f"Solde insuffisant. Solde actuel: {format_amount_for_tts(balance)} XOF"
            )
        
        if needs_confirmation:
            # Mettre en cache la transaction en attente de confirmation
            tx_id = self.cache.add(
                user_id=user_id,
                intent="transfer",
                amount=amount_value,
                recipient=recipient_value,
                ttl=300  # 5 min
            )
            
            message = (
                f"Voulez-vous envoyer {format_amount_for_tts(amount_value)} francs CFA "
                f"vers {format_recipient_for_tts(recipient_value)} ?"
            )
            
            return ActionResult(
                success=True,
                intent=Intent.TRANSFER.value,
                message=message,
                requires_confirmation=True,
                transaction_id=tx_id
            )
        else:
            # Exécuter directement
            return self._execute_transfer(user_id, amount_value, recipient_value)
    
    def _execute_transfer(
        self,
        user_id: str,
        amount: float,
        recipient: str,
        transaction_id: Optional[str] = None
    ) -> ActionResult:
        logger.info(f"✅ Exécution transfert: {amount} XOF → {recipient}")
        backend_result = self._execute_via_backend(Intent.TRANSFER, amount, recipient, None, transaction_id)
        if backend_result:
            return backend_result

        # Simulation locale
        user = self.users_db.get(user_id) or self.users_db["default"]
        user["balance"] = user.get("balance", 0) - amount
        if transaction_id:
            self.cache.confirm(transaction_id)
        return ActionResult(
            success=True,
            intent=Intent.TRANSFER.value,
            message=f"Transfert de {format_amount_for_tts(amount)} francs CFA vers {format_recipient_for_tts(recipient)} réussi.",
            transaction_id=transaction_id,
            data={"amount": amount, "recipient": recipient},
        )
    
    def _handle_deposit(
        self,
        user_id: str,
        amount: Optional[float],
        recipient: Optional[str],
        needs_confirmation: bool
    ) -> ActionResult:
        """Initier un dépôt d'argent"""
        amount_value = self._normalized_amount(amount)
        recipient_value = self._normalized_recipient(recipient)

        logger.info(f"💰 Dépôt: {amount_value} XOF → {recipient_value}")
        
        # Validation
        if amount_value is None:
            return ActionResult(
                success=False,
                intent=Intent.DEPOSIT.value,
                message="Montant invalide pour le dépôt"
            )
        
        if needs_confirmation:
            tx_id = self.cache.add(
                user_id=user_id,
                intent="deposit",
                amount=amount_value,
                recipient=recipient_value,
                ttl=300
            )
            
            if recipient_value:
                message = (
                    f"Voulez-vous déposer {format_amount_for_tts(amount_value)} francs CFA "
                    f"sur le compte de {format_recipient_for_tts(recipient_value)} ?"
                )
            else:
                message = f"Voulez-vous déposer {format_amount_for_tts(amount_value)} francs CFA ?"
            
            return ActionResult(
                success=True,
                intent=Intent.DEPOSIT.value,
                message=message,
                requires_confirmation=True,
                transaction_id=tx_id
            )
        else:
            return self._execute_deposit(user_id, amount_value, recipient_value)
    
    def _execute_deposit(
        self,
        _user_id: str,
        amount: float,
        recipient: Optional[str] = None,
        transaction_id: Optional[str] = None
    ) -> ActionResult:
        logger.info(f"✅ Exécution dépôt: {amount} XOF → {recipient}")
        backend_result = self._execute_via_backend(Intent.DEPOSIT, amount, recipient, None, transaction_id)
        if backend_result:
            return backend_result

        if transaction_id:
            self.cache.confirm(transaction_id)
        msg = (
            f"Dépôt de {format_amount_for_tts(amount)} francs CFA sur le compte de {format_recipient_for_tts(recipient)} effectué."
            if recipient else
            f"Dépôt de {format_amount_for_tts(amount)} francs CFA effectué."
        )
        return ActionResult(
            success=True, intent=Intent.DEPOSIT.value, message=msg,
            transaction_id=transaction_id, data={"amount": amount, "recipient": recipient},
        )
    
    def _handle_recharge(
        self,
        user_id: str,
        amount: Optional[float],
        needs_confirmation: bool
    ) -> ActionResult:
        """Initier une recharge crédit téléphonique"""
        amount_value = self._normalized_amount(amount)
        logger.info(f"📱 Recharge crédit: {amount_value} XOF")
        
        # Validation
        if amount_value is None:
            return ActionResult(
                success=False,
                intent=Intent.RECHARGE.value,
                message="Montant invalide pour recharge"
            )
        
        if needs_confirmation:
            tx_id = self.cache.add(
                user_id=user_id,
                intent="recharge",
                amount=amount_value,
                ttl=300
            )
            
            message = f"Voulez-vous acheter {format_amount_for_tts(amount_value)} francs CFA de crédit ?"
            
            return ActionResult(
                success=True,
                intent=Intent.RECHARGE.value,
                message=message,
                requires_confirmation=True,
                transaction_id=tx_id
            )
        else:
            return self._execute_recharge(user_id, amount_value)
    
    def _handle_withdraw(self, user_id: str, amount: Optional[float], needs_confirmation: bool) -> ActionResult:
        amount_value = self._normalized_amount(amount)
        logger.info(f"💵 Retrait: {amount_value} XOF")
        if amount_value is None:
            return ActionResult(success=False, intent=Intent.WITHDRAW.value, message="Montant invalide pour le retrait")
        if needs_confirmation:
            tx_id = self.cache.add(user_id=user_id, intent="withdraw", amount=amount_value, ttl=300)
            return ActionResult(
                success=True, intent=Intent.WITHDRAW.value,
                message=f"Voulez-vous retirer {format_amount_for_tts(amount_value)} francs CFA ?",
                requires_confirmation=True, transaction_id=tx_id,
            )
        return self._execute_withdraw(user_id, amount_value)

    def _execute_withdraw(self, user_id: str, amount: float, transaction_id: Optional[str] = None) -> ActionResult:
        logger.info(f"✅ Exécution retrait: {amount} XOF")
        backend_result = self._execute_via_backend(Intent.WITHDRAW, amount, None, None, transaction_id)
        if backend_result:
            return backend_result

        user = self.users_db.get(user_id) or self.users_db["default"]
        user["balance"] = user.get("balance", 0) - amount
        if transaction_id:
            self.cache.confirm(transaction_id)
        return ActionResult(
            success=True, intent=Intent.WITHDRAW.value,
            message=f"Retrait de {format_amount_for_tts(amount)} francs CFA autorisé. Présentez-vous au guichet le plus proche.",
            transaction_id=transaction_id, data={"amount": amount},
        )

    def _execute_recharge(self, user_id: str, amount: float, transaction_id: Optional[str] = None) -> ActionResult:
        logger.info(f"✅ Exécution recharge: {amount} XOF")
        backend_result = self._execute_via_backend(Intent.RECHARGE, amount, None, None, transaction_id)
        if backend_result:
            return backend_result

        user = self.users_db.get(user_id) or self.users_db["default"]
        user["balance"] = user.get("balance", 0) - amount
        if transaction_id:
            self.cache.confirm(transaction_id)
        return ActionResult(
            success=True, intent=Intent.RECHARGE.value,
            message=f"Recharge de {format_amount_for_tts(amount)} francs CFA effectuée sur votre téléphone.",
            transaction_id=transaction_id, data={"amount": amount},
        )
    
    def _handle_airtime(
        self,
        user_id: str,
        amount: Optional[float],
        airtime_type: str,
        needs_confirmation: bool
    ) -> ActionResult:
        """Initier un achat d'airtime spécialisé (forfaits internet, Go Pack, GAB)"""
        amount_value = self._normalized_amount(amount)
        logger.info(f"📱 Achat forfait: {airtime_type} - {amount_value} XOF")
        
        # Validation
        if amount_value is None:
            return ActionResult(
                success=False,
                intent=airtime_type,
                message="Montant invalide pour ce forfait"
            )
        
        if needs_confirmation:
            tx_id = self.cache.add(
                user_id=user_id,
                intent=airtime_type,
                amount=amount_value,
                service_type=airtime_type,
                ttl=300
            )
            
            # Build localized confirmation message
            if "gab" in airtime_type:
                forfait_name = "retrait GAB UBA"
            elif "gopack" in airtime_type:
                forfait_name = f"Go Pack {airtime_type.split('-')[1]}"
            else:  # internet
                forfait_name = f"Forfait internet {airtime_type.split('-')[1]}"
            
            message = f"Voulez-vous acheter le {forfait_name} pour {format_amount_for_tts(amount_value)} francs CFA ?"
            
            return ActionResult(
                success=True,
                intent=airtime_type,
                message=message,
                requires_confirmation=True,
                transaction_id=tx_id
            )
        else:
            return self._execute_airtime(user_id, amount_value, airtime_type)
    
    def _execute_airtime(
        self,
        user_id: str,
        amount: float,
        airtime_type: str,
        transaction_id: Optional[str] = None
    ) -> ActionResult:
        logger.info(f"✅ Exécution achat forfait: {airtime_type}")
        # Retrouver l'intent correspondant pour le mapping backend
        _airtime_intent_map = {
            "gab": Intent.WITHDRAW_GAB,
            "internet-jour": Intent.INTERNET_DAY, "internet-semaine": Intent.INTERNET_WEEK,
            "internet-mois": Intent.INTERNET_MONTH, "internet-illimite": Intent.INTERNET_UNLIMITED,
            "gopack-jour": Intent.GOPACK_DAY, "gopack-semaine": Intent.GOPACK_WEEK,
            "gopack-mois": Intent.GOPACK_MONTH,
        }
        matched_intent = _airtime_intent_map.get(airtime_type, Intent.RECHARGE)
        backend_result = self._execute_via_backend(matched_intent, amount, None, None, transaction_id)
        if backend_result:
            return backend_result

        user = self.users_db.get(user_id) or self.users_db["default"]
        user["balance"] = user.get("balance", 0) - amount
        if transaction_id:
            self.cache.confirm(transaction_id)
        if "gab" in airtime_type:
            forfait_name = "retrait GAB UBA"
        elif "gopack" in airtime_type:
            forfait_name = f"Go Pack {airtime_type.split('-')[1]}"
        else:
            forfait_name = f"Forfait internet {airtime_type.split('-')[1]}"
        return ActionResult(
            success=True, intent=airtime_type,
            message=f"Achat du {forfait_name} de {format_amount_for_tts(amount)} francs CFA accepté.",
            transaction_id=transaction_id, data={"amount": amount, "airtime_type": airtime_type},
        )
    
    def _handle_bill_payment(
        self,
        user_id: str,
        amount: Optional[float],
        service_type: Optional[str],
        needs_confirmation: bool
    ) -> ActionResult:
        """Initier le paiement d'une facture"""
        amount_value = self._normalized_amount(amount)
        logger.info(f"💡 Paiement facture: {service_type} - {amount_value} XOF")
        
        # Validation
        if amount_value is None:
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
                amount=amount_value,
                service_type=service_type,
                ttl=300
            )
            
            message = (
                f"Voulez-vous payer votre {service_type} "
                f"pour {format_amount_for_tts(amount_value)} francs CFA ?"
            )
            
            return ActionResult(
                success=True,
                intent=Intent.BILL_PAYMENT.value,
                message=message,
                requires_confirmation=True,
                transaction_id=tx_id
            )
        else:
            return self._execute_bill_payment(user_id, amount_value, service_type)
    
    def _execute_bill_payment(
        self,
        user_id: str,
        amount: float,
        service_type: str,
        transaction_id: Optional[str] = None
    ) -> ActionResult:
        logger.info(f"✅ Exécution paiement facture: {service_type}")
        backend_result = self._execute_via_backend(Intent.BILL_PAYMENT, amount, None, service_type, transaction_id)
        if backend_result:
            return backend_result

        user = self.users_db.get(user_id) or self.users_db["default"]
        user["balance"] = user.get("balance", 0) - amount
        if transaction_id:
            self.cache.confirm(transaction_id)
        return ActionResult(
            success=True, intent=Intent.BILL_PAYMENT.value,
            message=f"Paiement de votre {service_type} de {format_amount_for_tts(amount)} francs CFA accepté.",
            transaction_id=transaction_id, data={"amount": amount, "service": service_type},
        )
    
    def _handle_help(self) -> ActionResult:
        """Afficher l'aide"""
        message = """Je peux vous aider avec:
        
💰 Solde: "Quel est mon solde?"
💸 Transfert: "Envoie 5000 à Jean"
💳 Dépôt: "Fait un dépôt de 2000 à Aurel"
💵 Retrait: "Je veux retirer 10000"
📱 Recharge: "Recharge 1000"
💡 Factures: "Paye ma facture d'électricité pour 25000"

Dites toujours les montants en francs CFA.
Je peux résoudre les noms de vos contacts automatiquement."""
        
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
