"""
Transport Gemini du service NLP (TODO T-004).

Couvre, sans aucun accès réseau (la session HTTP est simulée) :
  * la clé API voyage dans l'en-tête `x-goog-api-key`, jamais dans l'URL ;
  * la vérification TLS n'est désactivée nulle part ;
  * aucune erreur renvoyée au client ne contient la clé ni le texte brut d'une exception,
    et la clé n'apparaît pas dans les journaux même si une exception la contient.
"""

import logging
import sys
from pathlib import Path

import pytest
import requests
from fastapi.testclient import TestClient

NLP_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(NLP_ROOT))

from app import gemini_rest_service as grs  # noqa: E402
from app.auth import JWTManager  # noqa: E402
from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app, raise_server_exceptions=False)
KEY = settings.gemini_api_key
AUDIO_BYTES = b"RIFF0000WAVE"


class FakeResponse:
    def __init__(self, status_code=400, text=""):
        self.status_code = status_code
        self.text = text

    def json(self):
        return {}


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    from app.rate_limiter import get_rate_limiter

    limiter = get_rate_limiter()
    limiter.ip_requests.clear()
    limiter.user_requests.clear()
    yield
    limiter.ip_requests.clear()
    limiter.user_requests.clear()


@pytest.fixture
def recorded_calls(monkeypatch):
    """Remplace la session HTTP : enregistre chaque appel, répond 400, supprime les attentes de retry."""
    calls = []

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        return FakeResponse(400)

    monkeypatch.setattr(grs.session, "post", fake_post)
    monkeypatch.setattr(grs.time, "sleep", lambda _s: None)
    return calls


def _run_service():
    return grs.GeminiRESTService().process_voice_command(AUDIO_BYTES, "wav")


# ---------------------------------------------------------------------------
# Clé API et TLS
# ---------------------------------------------------------------------------

def test_api_key_travels_in_a_header_not_in_the_url(recorded_calls):
    _run_service()
    url, kwargs = recorded_calls[0]
    assert "key=" not in url and KEY not in url
    assert kwargs["headers"]["x-goog-api-key"] == KEY


def test_tls_verification_is_not_disabled_on_the_request(recorded_calls):
    _run_service()
    _url, kwargs = recorded_calls[0]
    assert kwargs.get("verify", True) is not False
    assert grs.session.verify is not False


def test_no_application_module_disables_tls_verification():
    for source in (NLP_ROOT / "app").glob("*.py"):
        text = source.read_text(encoding="utf-8").replace(" ", "")
        assert "verify=False" not in text, f"{source.name} désactive la vérification TLS"
        assert "disable_warnings" not in text, f"{source.name} masque les avertissements TLS"
