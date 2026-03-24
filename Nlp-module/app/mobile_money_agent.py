"""
Agent Mobile Money - Version simplifiée
Intègre Grok NLP + Backend Mobile Money
Fonctionne avec le pipeline Web Speech API (browser) → Grok → TTS (browser)

Pour le vrai LiveKit real-time, voir: run_voice_agent_local.sh
"""

import json
from typing import Dict, Optional


class MobileMoneyNLP:
    """
    Module NLP qui utilise Grok pour analyser les commandes vocales
    """
    
    def __init__(self):
        # Import local du service Grok
        from app.service import CommandParserService
        self.parser = CommandParserService()
    
    async def analyze_command(self, text: str) -> Dict:
        """
        Analyse une commande vocale avec Grok
        
        Args:
            text: Transcription de la commande ("Envoie 5000 à Jean")
        
        Returns:
            {
                "intent": "transfer_money",
                "entities": {"amount": 5000, "recipient": "Jean"},
                "confidence": 0.95
            }
        """
        try:
            # Utiliser le service existant
            result = await self.parser.parse(text)
            
            return {
                "intent": str(result.intent.value),
                "entities": {
                    "amount": result.amount,
                    "recipient": result.recipient,
                    "service": result.bill_type,
                },
                "confidence": result.metadata.confidence,
                "message": result.confirmation_message,
            }
            
        except Exception as e:
            print(f"❌ Erreur analyse Grok : {e}")
            return {
                "intent": "unknown",
                "entities": {},
                "confidence": 0.0,
                "error": str(e)
            }


class MobileMoneyBackend:
    """
    Interface avec le backend Mobile Money
    (Simulé pour l'instant, à remplacer par vraies APIs)
    """
    
    def __init__(self):
        self.user_balance = 50000  # Solde simulé
    
    async def check_balance(self) -> str:
        """Consulter le solde"""
        return f"Votre solde est de {self.user_balance} francs CFA"
    
    async def transfer_money(self, amount: int, recipient: str) -> str:
        """Transférer de l'argent"""
        if amount > self.user_balance:
            return f"Solde insuffisant. Votre solde actuel est de {self.user_balance} francs"
        
        self.user_balance -= amount
        return f"Transfert de {amount} francs à {recipient} effectué avec succès. Nouveau solde : {self.user_balance} francs"
    
    async def buy_credit(self, amount: int) -> str:
        """Acheter du crédit téléphonique"""
        if amount > self.user_balance:
            return f"Solde insuffisant pour acheter {amount} francs de crédit"
        
        self.user_balance -= amount
        return f"Recharge de {amount} francs effectuée avec succès"
    
    async def pay_bill(self, amount: int, service: str) -> str:
        """Payer une facture"""
        if amount > self.user_balance:
            return f"Solde insuffisant pour payer la facture"
        
        self.user_balance -= amount
        service_name = service or "votre facture"
        return f"Paiement de {amount} francs pour {service_name} effectué avec succès"


class MobileMoneyAgent:
    """
    Agent principal qui orchestre Grok et le backend Mobile Money
    """
    
    def __init__(self):
        self.nlp = MobileMoneyNLP()
        self.backend = MobileMoneyBackend()
    
    async def process_command(self, transcription: str) -> str:
        """
        Traite une commande vocale complète
        
        Args:
            transcription: Texte de la commande ("Envoie 5000 à Jean")
        
        Returns:
            Réponse textuelle à synthétiser en audio
        """
        
        print(f"📝 Transcription reçue : {transcription}")
        
        # 1. Analyse NLP avec Grok
        nlp_result = await self.nlp.analyze_command(transcription)
        print(f"🧠 Analyse Grok : {json.dumps(nlp_result, indent=2, ensure_ascii=False)}")
        
        intent = nlp_result.get("intent")
        entities = nlp_result.get("entities", {})
        
        # 2. Vérifier la confiance
        if nlp_result.get("confidence", 0) < 0.5:
            return "Je n'ai pas bien compris votre demande. Pouvez-vous répéter ?"
        
        # 3. Exécuter l'action selon l'intent
        try:
            if intent == "balance":
                response = await self.backend.check_balance()
            
            elif intent == "transfer":
                amount = entities.get("amount")
                recipient = entities.get("recipient")
                
                # Vérifier que les entités nécessaires sont présentes
                if not amount:
                    return "Quel montant voulez-vous envoyer ?"
                if not recipient:
                    return "À qui voulez-vous envoyer cet argent ?"
                
                response = await self.backend.transfer_money(amount, recipient)
            
            elif intent == "recharge":
                amount = entities.get("amount")
                
                if not amount:
                    return "Quel montant de crédit voulez-vous acheter ?"
                
                response = await self.backend.buy_credit(amount)
            
            elif intent == "bill_payment":
                amount = entities.get("amount")
                service = entities.get("service")
                
                if not amount:
                    return "Quel est le montant de la facture ?"
                
                response = await self.backend.pay_bill(amount, service)
            
            elif intent == "help":
                response = """Je peux vous aider avec :
- Consulter votre solde : dites 'Quel est mon solde'
- Transférer de l'argent : dites 'Envoie 5000 francs à Jean'
- Acheter du crédit : dites 'Recharge 2000 francs'
- Payer une facture : dites 'Paye ma facture d'électricité'
"""
            
            else:
                response = "Je n'ai pas compris votre demande. Demandez 'Aide' pour voir ce que je peux faire."
            
            print(f"✅ Réponse : {response}")
            return response
            
        except Exception as e:
            print(f"❌ Erreur exécution : {e}")
            return "Désolé, une erreur s'est produite. Veuillez réessayer."


# Point d'entrée pour l'API REST (compatible avec le hook React actuel)
async def get_agent_response(transcription: str) -> str:
    """Endpoint helper pour intégration REST"""
    agent = MobileMoneyAgent()
    return await agent.process_command(transcription)

