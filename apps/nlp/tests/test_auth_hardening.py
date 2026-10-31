"""
Durcissement de l'authentification du service NLP (TODO T-002).

Couvre :
  * les endpoints "de test" (jetons sans identifiants, données mock keyées par user_id) sont
    désactivés par défaut (404) et ne s'activent qu'avec ENABLE_TEST_ENDPOINTS=true ;
  * tous les endpoints métier exigent un JWT valide (pas de repli sur l'utilisateur "default") ;
  * un jeton falsifié, expiré ou signé avec l'algorithme "none" est refusé ;
  * le service refuse de démarrer sans JWT_SECRET (pas de secret par défaut public).
"""

import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pytest
from fastapi.testclient import TestClient

NLP_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(NLP_ROOT))

from app.main import app, executor  # noqa: E402
from app.auth import JWTManager, JWT_SECRET  # noqa: E402

client = TestClient(app)

# (méthode, chemin, corps JSON)
TEST_ONLY_ENDPOINTS = [
    ("post", "/api/auth/token?user_id=victim", None),
    ("post", "/api/auth/login", {"phone": "0197000000", "pin": "9999"}),
    ("post", "/api/auth/register", {"phone": "0197000000", "pin": "9999"}),
    ("get", "/api/users/profile?user_id=default", None),
    ("get", "/api/users/balance?user_id=default", None),
    ("post", "/api/users/balance", {"balance": 999999, "user_id": "default"}),
    ("get", "/api/transactions?user_id=default", None),
]


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    """Drapeau désactivé par défaut, compteurs de rate limit remis à zéro, solde 'default' restauré."""
    monkeypatch.delenv("ENABLE_TEST_ENDPOINTS", raising=False)
    from app.rate_limiter import get_rate_limiter

    limiter = get_rate_limiter()
    limiter.ip_requests.clear()
    limiter.user_requests.clear()
    original_balance = executor.users_db["default"]["balance"]
    yield
    executor.users_db["default"]["balance"] = original_balance
    limiter.ip_requests.clear()
    limiter.user_requests.clear()


def _call(method, path, body=None, headers=None):
    return getattr(client, method)(path, json=body, headers=headers) if body is not None else getattr(client, method)(path, headers=headers)


# ---------------------------------------------------------------------------
# Endpoints de test : fermés par défaut
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("method,path,body", TEST_ONLY_ENDPOINTS)
def test_test_only_endpoints_are_404_by_default(method, path, body):
    assert _call(method, path, body).status_code == 404


def test_disabled_balance_endpoint_does_not_mutate_state():
    before = executor.users_db["default"]["balance"]
    client.post("/api/users/balance", json={"balance": 999999, "user_id": "default"})
    assert executor.users_db["default"]["balance"] == before


def test_no_token_can_be_obtained_without_credentials_by_default():
    for path, body in [("/api/auth/token?user_id=victim", None), ("/api/auth/login", {"phone": "0197000000", "pin": "x"})]:
        response = _call("post", path, body)
        assert "access_token" not in response.text and "token" not in response.json()


def test_test_only_endpoints_work_when_explicitly_enabled(monkeypatch):
    monkeypatch.setenv("ENABLE_TEST_ENDPOINTS", "true")
    token = client.post("/api/auth/token?user_id=dev_user")
    assert token.status_code == 200 and "access_token" in token.json()
    assert client.post("/api/auth/login", json={"phone": "0197000000", "pin": "1234"}).status_code == 200
    assert client.get("/api/users/profile?user_id=default").status_code == 200
    assert client.get("/api/transactions?user_id=default").status_code == 200


# ---------------------------------------------------------------------------
# Endpoints métier : JWT obligatoire, aucun repli sur "default"
# ---------------------------------------------------------------------------

AUDIO = {"audio_file": ("a.wav", b"RIFF0000WAVE", "audio/wav")}

PROTECTED = [
    ("post", "/api/cancel", {"transaction_id": "x"}, None),
    ("post", "/api/confirm", {"transaction_id": "x"}, None),
    ("post", "/api/users/contacts", {"contacts": []}, None),
    ("get", "/api/pending-transactions", None, None),
    ("post", "/api/voice-command", None, AUDIO),
]


def _protected_call(method, path, body, files, headers=None):
    kwargs = {"headers": headers}
    if body is not None:
        kwargs["json"] = body
    if files is not None:
        kwargs["files"] = files
    return getattr(client, method)(path, **kwargs)


@pytest.mark.parametrize("method,path,body,files", PROTECTED)
def test_protected_endpoints_reject_missing_token(method, path, body, files):
    assert _protected_call(method, path, body, files).status_code == 401


@pytest.mark.parametrize("method,path,body,files", PROTECTED)
def test_protected_endpoints_reject_garbage_token(method, path, body, files):
    assert _protected_call(method, path, body, files, {"Authorization": "Bearer not.a.jwt"}).status_code == 401


def test_pending_transactions_ignores_a_caller_supplied_user_id():
    """L'identité vient du jeton ; ?user_id=<autre> ne doit rien exposer ni être accepté sans jeton."""
    assert client.get("/api/pending-transactions?user_id=someone-else").status_code == 401
    token = JWTManager.encode_token("owner")
    ok = client.get("/api/pending-transactions?user_id=someone-else", headers={"Authorization": f"Bearer {token}"})
    assert ok.status_code == 200 and ok.json()["user_id"] == "owner"


def test_valid_token_is_accepted():
    token = JWTManager.encode_token("legit_user")
    response = client.get("/api/pending-transactions", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_token_signed_with_another_secret_is_rejected():
    forged = jwt.encode({"user_id": "victim", "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, "attacker-secret", algorithm="HS256")
    assert client.get("/api/pending-transactions", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_expired_token_is_rejected():
    expired = jwt.encode({"user_id": "victim", "exp": datetime.now(timezone.utc) - timedelta(hours=1)}, JWT_SECRET, algorithm="HS256")
    assert client.get("/api/pending-transactions", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_unsigned_alg_none_token_is_rejected():
    unsigned = jwt.encode({"user_id": "victim"}, key=None, algorithm="none")
    assert client.get("/api/pending-transactions", headers={"Authorization": f"Bearer {unsigned}"}).status_code == 401


# ---------------------------------------------------------------------------
# Démarrage : pas de secret par défaut
# ---------------------------------------------------------------------------

def test_service_refuses_to_start_without_jwt_secret():
    env = {k: v for k, v in os.environ.items() if k != "JWT_SECRET"}
    result = subprocess.run(
        [sys.executable, "-c", "import app.auth"],
        cwd=NLP_ROOT, env=env, capture_output=True, text=True, timeout=60,
    )
    assert result.returncode != 0
    assert "JWT_SECRET" in result.stderr


def test_service_starts_with_a_jwt_secret():
    env = dict(os.environ, JWT_SECRET="some-secret-for-this-check")
    result = subprocess.run(
        [sys.executable, "-c", "import app.auth"],
        cwd=NLP_ROOT, env=env, capture_output=True, text=True, timeout=60,
    )
    assert result.returncode == 0, result.stderr
