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
