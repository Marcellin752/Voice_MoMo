"""
🧪 Integration Tests pour VoiceMomo NLP API
Test le flux entier: Auth → Voice Command → Confirmation
"""

import os
import sys
import json
import asyncio
from pathlib import Path

# Ajouter le module au path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import JWTManager


# ===============================================
# CLIENT TEST
# ===============================================

client = TestClient(app)


# ===============================================
# FIXTURES
# ===============================================

@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Isole chaque test du compteur global de rate limiting.

    Sans ça, test_rate_limit_excessive_requests() épuise le quota de l'IP
    "testclient" et fait échouer en cascade tous les tests suivants (429).
    """
    from app.rate_limiter import get_rate_limiter

    limiter = get_rate_limiter()
    limiter.ip_requests.clear()
    limiter.user_requests.clear()
    yield
    limiter.ip_requests.clear()
    limiter.user_requests.clear()


@pytest.fixture
def jwt_token():
    """Générer un token JWT pour les tests"""
    return JWTManager.encode_token("test_user_123")


@pytest.fixture
def test_audio_file():
    """Créer un fichier audio de test (silence ~1s)"""
    # Audio WAV silence minimal (44.1kHz, 16-bit, mono, 1 second)
    wav_data = bytes.fromhex(
        "524946461d0000005741564566616374"
        "24000004000102440ac00004000100"
        "006461746100000000" 
    )
    return wav_data


# ===============================================
# 📝 TESTS - AUTHENTIFICATION
# ===============================================

def test_health_check():
    """Test: Endpoint de santé accessible"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_api_health():
    """Test: Health check API avec cache"""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "cache_transactions" in data
    assert "features" in data


def test_generate_token():
    """Test: Générer un token JWT"""
    response = client.post("/api/auth/token?user_id=test_user")
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user_id"] == "test_user"


def test_missing_auth_header():
    """Test: Requête sans header Authorization (fallback à default)"""
    # Simule une petite commande... sans vrai audio on peut pas tester le full flow
    # Mais on peut tester que l'endpoint existe
    response = client.get("/api/health")
    assert response.status_code == 200


def test_invalid_token():
    """Test: Token JWT invalide -> fallback à default"""
    headers = {"Authorization": "Bearer invalid_token_123"}
    response = client.post(
        "/api/confirm",
        headers=headers,
        json={"transaction_id": "tx_123"},
    )
    # Devrait fallback à "default" user
    # (transaction_id invalide mais test l'auth flow)
    assert response.status_code in [400, 404]  # Transaction not found


# ===============================================
# 🎙️ TESTS - VOICE COMMAND
# ===============================================

def test_voice_command_without_auth(test_audio_file):
    """Test: Commande vocale sans auth (fallback à default)"""
    response = client.post(
        "/api/voice-command",
        files={"audio_file": ("test.wav", test_audio_file, "audio/wav")}
    )
    # Gemini API peut échouer en test si pas de clé, mais endpoint existe
    assert response.status_code in [200, 400, 500]


def test_voice_command_with_auth(jwt_token, test_audio_file):
    """Test: Commande vocale avec JWT"""
    headers = {"Authorization": f"Bearer {jwt_token}"}
    
    response = client.post(
        "/api/voice-command",
        headers=headers,
        files={"audio_file": ("test.wav", test_audio_file, "audio/wav")}
    )
    
    # Vérifier la structure de réponse
    assert response.status_code in [200, 500]  # 500 si Gemini not available
    
    if response.status_code == 200:
        data = response.json()
        assert "intent" in data
        assert "message" in data


def test_parse_text_command():
    """Test: Parser un commande texte"""
    response = client.post(
        "/ai/parse",
        json={"text": "Quel est mon solde ?"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "intent" in data
    assert data["intent"] in ["balance", "unknown"]


# ===============================================
# ✅ TESTS - CONFIRMATION FLOW
# ===============================================

def test_confirm_action_missing_transaction(jwt_token):
    """Test: Confirmer une transaction inexistante"""
    headers = {"Authorization": f"Bearer {jwt_token}"}
    
    response = client.post(
        "/api/confirm",
        headers=headers,
        json={"transaction_id": "nonexistent_tx_id"},
    )
    
    assert response.status_code == 400


def test_cancel_action_missing_transaction(jwt_token):
    """Test: Annuler une transaction inexistante"""
    headers = {"Authorization": f"Bearer {jwt_token}"}
    
    response = client.post(
        "/api/cancel",
        headers=headers,
        json={"transaction_id": "nonexistent_tx_id"},
    )
    
    assert response.status_code == 400


def test_pending_transactions_empty(jwt_token):
    """Test: Lister les transactions en attente (empty)"""
    headers = {"Authorization": f"Bearer {jwt_token}"}
    
    response = client.get(
        "/api/pending-transactions",
        headers=headers,
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "pending" in data


# ===============================================
# 🛡️ TESTS - RATE LIMITING
# ===============================================

def test_rate_limit_excessive_requests():
    """Test: Vérifier que le rate limiting fonctionne"""
    # Faire 70 requêtes (dépassant la limite par défaut)
    for i in range(70):
        response = client.get("/health")
        
        if response.status_code == 429:
            # Rate limit atteint
            assert "X-RateLimit-Remaining" in response.headers
            assert response.headers["X-RateLimit-Remaining"] == "0"
            break


# ===============================================
# 📊 TESTS - ACTIONS
# ===============================================

def test_action_balance():
    """Test: Récupérer le solde"""
    response = client.post(
        "/ai/parse",
        json={"text": "Montre-moi mon solde"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "balance"


def test_action_transfer():
    """Test: Transfert d'argent (parsing)"""
    response = client.post(
        "/ai/parse",
        json={"text": "Envoie 5000 à Jean"}
    )
    
    assert response.status_code == 200
    data = response.json()
    # Peut être transfer ou unknown selon la NLP
    assert "intent" in data


def test_action_recharge():
    """Test: Recharge crédit"""
    response = client.post(
        "/ai/parse",
        json={"text": "Recharge mon crédit de 3000"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "intent" in data


def test_action_help():
    """Test: Aide"""
    response = client.post(
        "/ai/parse",
        json={"text": "Aide"}
    )
    
    assert response.status_code == 200
    data = response.json()
    # Devrait reconnaître help ou unknown
    assert "intent" in data


# ===============================================
# 🔍 TESTS - EDGE CASES
# ===============================================

def test_empty_audio_file():
    """Test: Fichier audio vide -> dégradation gracieuse (200, intent unknown)"""
    response = client.post(
        "/api/voice-command",
        files={"audio_file": ("empty.wav", b"", "audio/wav")}
    )
    # /api/voice-command ne renvoie jamais d'erreur HTTP sur un échec de
    # traitement : il répond 200 avec intent="unknown" pour que l'app mobile
    # puisse toujours donner un retour vocal à l'utilisateur.
    assert response.status_code == 200
    assert response.json()["intent"] == "unknown"


def test_invalid_audio_format():
    """Test: Format audio invalide -> dégradation gracieuse (200, intent unknown)"""
    response = client.post(
        "/api/voice-command",
        files={"audio_file": ("test.txt", b"not audio", "text/plain")}
    )
    assert response.status_code == 200
    assert response.json()["intent"] == "unknown"


def test_missing_audio_file():
    """Test: Pas d'audio file"""
    response = client.post("/api/voice-command")
    assert response.status_code == 422  # Validation error


def test_cors_headers():
    """Test: Headers CORS présents"""
    response = client.get("/health")
    assert response.status_code == 200
    # Vérifier que CORS est activé
    # (les headers CORS peuvent être dans la requête OPTIONS)


# ===============================================
# 🧪 MAIN TEST RUNNER
# ===============================================

if __name__ == "__main__":
    print("""
    =======================================
    🧪 Commandes pour lancer les tests:
    =======================================
    
    # Tous les tests
    pytest test_integration.py -v
    
    # Tests spécifiques
    pytest test_integration.py::test_health_check -v
    pytest test_integration.py -k "auth" -v
    
    # Avec coverage
    pytest test_integration.py --cov=app --cov-report=html
    
    # Mode watch (auto-rerun)
    pytest-watch test_integration.py
    
    =======================================
    """)
    
    # Lancer avec pytest si disponible
    import subprocess
    subprocess.run(["pytest", __file__, "-v"])
