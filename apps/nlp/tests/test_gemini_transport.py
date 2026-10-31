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


# ---------------------------------------------------------------------------
# Aucune fuite dans les réponses ni dans les journaux
# ---------------------------------------------------------------------------

def test_connection_error_never_leaks_the_key(monkeypatch, caplog):
    def boom(_url, **_kwargs):
        raise requests.exceptions.ConnectionError(
            "HTTPSConnectionPool(host='generativelanguage.googleapis.com', port=443): Max retries exceeded "
            f"with url: /v1beta/models/m:generateContent?key={KEY}"
        )

    monkeypatch.setattr(grs.session, "post", boom)
    monkeypatch.setattr(grs.time, "sleep", lambda _s: None)
    caplog.set_level(logging.DEBUG)

    result = _run_service()

    assert result["success"] is False
    assert KEY not in str(result)
    assert "HTTPSConnectionPool" not in str(result)
    assert KEY not in caplog.text


def test_unexpected_exception_detail_is_not_returned(monkeypatch):
    def boom(_url, **_kwargs):
        raise ValueError("internal detail in /srv/app/secret_module.py")

    monkeypatch.setattr(grs.session, "post", boom)
    monkeypatch.setattr(grs.time, "sleep", lambda _s: None)

    result = _run_service()

    assert result["success"] is False
    assert "internal detail" not in str(result)
    assert "secret_module" not in str(result)


def test_parse_failure_does_not_echo_the_exception_text():
    parsed = grs.GeminiRESTService()._parse_nlp_response("{not valid json}")
    raw = parsed.metadata.raw_output
    assert "Expecting" not in raw and "column" not in raw


def test_voice_command_500_does_not_echo_exception_text(monkeypatch):
    def explode():
        raise RuntimeError("secret-internal-detail")

    monkeypatch.setattr("app.main.get_voice_service", explode)
    token = JWTManager.encode_token("transport_test_user")

    response = client.post(
        "/api/voice-command",
        files={"audio_file": ("a.wav", AUDIO_BYTES, "audio/wav")},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 500
    assert "secret-internal-detail" not in response.text
    assert "RuntimeError" not in response.text


# ---------------------------------------------------------------------------
# Client /ai/parse (T-004 partie 2) — même contrat que le chemin vocal
# ---------------------------------------------------------------------------

def _run_parse_client(monkeypatch, post_fn):
    import asyncio
    import app.gemini_client as gc

    monkeypatch.setattr(gc.requests, "post", post_fn)
    monkeypatch.setattr(gc.time, "sleep", lambda _s: None)
    return asyncio.run(gc.GeminiClient().parse_command("quel est mon solde"))


def test_parse_client_api_key_travels_in_a_header_not_in_the_url(monkeypatch):
    calls = []

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        resp = FakeResponse(400)

        def raise_for_status():
            raise requests.HTTPError("400 Client Error")

        resp.raise_for_status = raise_for_status  # type: ignore[method-assign]
        return resp

    with pytest.raises(RuntimeError):
        _run_parse_client(monkeypatch, fake_post)

    assert calls, "GeminiClient n'a pas appelé requests.post"
    url, kwargs = calls[0]
    assert "key=" not in url and KEY not in url
    assert kwargs.get("headers", {}).get("x-goog-api-key") == KEY


def test_parse_client_url_does_not_embed_the_key():
    from app.gemini_client import GeminiClient

    url = GeminiClient().url
    assert "key=" not in url
    assert KEY not in url


def test_parse_client_connection_error_never_leaks_the_key(monkeypatch):
    def boom(_url, **_kwargs):
        raise requests.exceptions.ConnectionError(
            "HTTPSConnectionPool(host='generativelanguage.googleapis.com', port=443): Max retries exceeded "
            f"with url: /v1beta/models/m:generateContent?key={KEY}"
        )

    with pytest.raises(RuntimeError) as exc:
        _run_parse_client(monkeypatch, boom)

    assert KEY not in str(exc.value)
    assert "HTTPSConnectionPool" not in str(exc.value)
