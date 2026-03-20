import asyncio
import importlib
import logging
import os
import ssl

from dotenv import load_dotenv
from livekit import api, rtc

from app.config import settings
from app.voice_agent import build_tools

load_dotenv()

logger = logging.getLogger("voice-momo-grok-agent-local")
logging.basicConfig(level=logging.INFO)


def _build_token(room_name: str, identity: str) -> str:
    if not settings.livekit_api_key or not settings.livekit_api_secret:
        raise RuntimeError("LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required")

    grants = api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
    )

    token = (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(identity)
        .with_name(identity)
        .with_grants(grants)
        .to_jwt()
    )
    return token


async def main() -> None:
    agents = importlib.import_module("livekit.agents")
    xai = importlib.import_module("livekit.plugins.xai")
    aiohttp = importlib.import_module("aiohttp")

    room_name = os.getenv("LIVEKIT_ROOM", "voice-momo-local")
    identity = os.getenv("LIVEKIT_AGENT_IDENTITY", f"voice-agent-local-{os.getpid()}")

    if not settings.livekit_url:
        raise RuntimeError("LIVEKIT_URL is required")
    if not settings.xai_api_key:
        raise RuntimeError("XAI_API_KEY is required")

    token = _build_token(room_name, identity)

    room = rtc.Room()
    await room.connect(settings.livekit_url, token)
    logger.info("Agent connected to room: %s", room_name)

    connector = None
    if settings.disable_ssl_verify:
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        connector = aiohttp.TCPConnector(ssl=ssl_context)

    http_session = aiohttp.ClientSession(connector=connector)

    instructions = (
        "Tu es un assistant Mobile Money vocal en francais. "
        "Utilise les outils pour solde, transfert, recharge et paiement facture. "
        "Pour transfert, recharge, facture: prepare l'action puis attends confirmation. "
        "Si l'utilisateur dit Oui, appelle confirmer_action. "
        "Si l'utilisateur dit Non, appelle annuler_action. "
        "Ne jamais inventer le resultat d'une transaction."
    )

    agent = agents.Agent(
        instructions=instructions,
        llm=xai.realtime.RealtimeModel(
            voice=settings.xai_voice,
            http_session=http_session,
        ),
        tools=build_tools(room_name, agents.llm),
    )

    session = agents.AgentSession()

    @session.on("user_input_transcribed")
    def on_user_transcribed(ev):
        if ev.transcript.strip():
            logger.info("User said: %s", ev.transcript)

    @session.on("error")
    def on_error(ev):
        message = getattr(ev, "message", str(ev))
        logger.error("Session error: %s", message)

    await session.start(agent, room=room)
    logger.info("Local voice agent ready. Press Ctrl+C to stop.")

    stop_event = asyncio.Event()
    try:
        await stop_event.wait()
    except KeyboardInterrupt:
        logger.info("Stopping local voice agent...")
    finally:
        await room.disconnect()
        await http_session.close()


if __name__ == "__main__":
    asyncio.run(main())
