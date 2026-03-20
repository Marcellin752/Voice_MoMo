import asyncio
import logging
import ssl
import importlib
from typing import Annotated

from dotenv import load_dotenv

from app.backend_actions import BackendActionClient
from app.config import settings

load_dotenv()

logger = logging.getLogger("voice-momo-grok-agent")
logging.basicConfig(level=logging.INFO)

backend_client = BackendActionClient()
_pending_actions: dict[str, dict] = {}


def build_tools(session_key: str, llm) -> list:
    @llm.function_tool
    async def consulter_solde() -> str:
        """Consulte le solde Mobile Money de l'utilisateur."""
        result = await backend_client.run("balance", {})
        if result.get("status") == "simulated":
            return "Votre solde est de 125000 francs CFA en mode simulation."
        amount = result.get("balance", "indisponible")
        return f"Votre solde actuel est {amount} francs CFA."

    @llm.function_tool
    async def preparer_transfert(
        montant: Annotated[int, "Montant en francs CFA"],
        destinataire: Annotated[str, "Nom du contact ou numero Mobile Money"],
    ) -> str:
        """Prepare un transfert et demande la confirmation vocale de l'utilisateur."""
        _pending_actions[session_key] = {
            "action": "transfer",
            "payload": {"amount": montant, "recipient": destinataire},
        }
        return f"Voulez-vous envoyer {montant} francs CFA a {destinataire} ? Dites Oui pour confirmer." 

    @llm.function_tool
    async def preparer_recharge(
        montant: Annotated[int, "Montant en francs CFA"],
    ) -> str:
        """Prepare une recharge et demande la confirmation vocale de l'utilisateur."""
        _pending_actions[session_key] = {
            "action": "recharge",
            "payload": {"amount": montant},
        }
        return f"Voulez-vous acheter {montant} francs de credit ? Dites Oui pour confirmer."

    @llm.function_tool
    async def preparer_paiement_facture(
        type_facture: Annotated[str, "Type de facture: electricite, eau ou internet"],
        montant: Annotated[int, "Montant en francs CFA"],
    ) -> str:
        """Prepare un paiement de facture et demande la confirmation vocale de l'utilisateur."""
        _pending_actions[session_key] = {
            "action": "bill_payment",
            "payload": {"bill_type": type_facture, "amount": montant},
        }
        return f"Voulez-vous payer {montant} francs pour la facture {type_facture} ? Dites Oui pour confirmer."

    @llm.function_tool
    async def confirmer_action() -> str:
        """Execute l'action en attente apres confirmation explicite de l'utilisateur."""
        pending = _pending_actions.get(session_key)
        if not pending:
            return "Aucune action en attente a confirmer."

        result = await backend_client.run(pending["action"], pending["payload"])
        _pending_actions.pop(session_key, None)

        if result.get("status") == "simulated":
            return "Action confirmee en mode simulation."

        if result.get("status") == "success":
            return "Operation executee avec succes."

        return "Je n'ai pas pu executer l'operation. Veuillez reessayer."

    @llm.function_tool
    async def annuler_action() -> str:
        """Annule l'action en attente."""
        pending = _pending_actions.pop(session_key, None)
        if not pending:
            return "Aucune action en attente a annuler."
        return "Operation annulee."

    @llm.function_tool
    async def aide_commandes() -> str:
        """Donne les exemples de commandes vocales disponibles."""
        return (
            "Vous pouvez dire: Quel est mon solde, Envoie 5000 a Jean, "
            "Recharge 2000, ou Paye facture electricite 10000."
        )

    return [
        consulter_solde,
        preparer_transfert,
        preparer_recharge,
        preparer_paiement_facture,
        confirmer_action,
        annuler_action,
        aide_commandes,
    ]


def _load_livekit_runtime():
    try:
        agents = importlib.import_module("livekit.agents")
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Le package livekit.agents est introuvable. "
            "Lancez run_voice_agent.sh avec un Python qui contient LiveKit."
        ) from exc

    required = ["Agent", "AgentSession", "AutoSubscribe", "WorkerOptions", "cli", "llm"]
    missing = [name for name in required if not hasattr(agents, name)]
    if missing:
        raise RuntimeError(
            "Version livekit.agents incompatible (symbols manquants: "
            + ", ".join(missing)
            + "). Utilisez le venv softride qui a la version compatible."
        )

    return agents


async def entrypoint(ctx):
    agents = _load_livekit_runtime()
    Agent = agents.Agent
    AgentSession = agents.AgentSession
    AutoSubscribe = agents.AutoSubscribe
    llm = agents.llm

    room_name = ctx.room.name
    logger.info("Starting Grok voice job for room: %s", room_name)

    try:
        xai = importlib.import_module("livekit.plugins.xai")
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Le plugin livekit.plugins.xai est introuvable dans cet environnement Python. "
            "Utilisez le venv de softride qui le contient deja, ou installez ce plugin avant de lancer le mode voix."
        ) from exc

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    aiohttp = importlib.import_module("aiohttp")

    connector = None
    if settings.disable_ssl_verify:
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        connector = aiohttp.TCPConnector(ssl=ssl_context)

    http_session = aiohttp.ClientSession(connector=connector)

    instructions = (
        "Tu es un assistant Mobile Money vocal en francais. "
        "Tu dois utiliser les outils pour les actions de solde, transfert, recharge et paiement facture. "
        "Pour transfert, recharge, facture: prepare l'action puis attends confirmation explicite. "
        "Si l'utilisateur dit Oui, appelle confirmer_action. "
        "Si l'utilisateur dit Non, appelle annuler_action. "
        "Ne jamais inventer le resultat d'une transaction."
    )

    agent = Agent(
        instructions=instructions,
        llm=xai.realtime.RealtimeModel(
            voice=settings.xai_voice,
            http_session=http_session,
        ),
        tools=build_tools(room_name, llm),
    )

    session = AgentSession()

    @session.on("user_input_transcribed")
    def on_user_transcribed(ev):
        if ev.transcript.strip():
            logger.info("User said: %s", ev.transcript)

    @session.on("error")
    def on_error(ev):
        message = getattr(ev, "message", str(ev))
        logger.error("Session error: %s", message)

    await session.start(agent, room=ctx.room)
    logger.info("Grok voice assistant is running.")

    done = asyncio.Future()

    @session.on("close")
    def on_close(ev):
        logger.info("Session closed: %s", ev.reason)
        if not done.done():
            done.set_result(True)

    try:
        await done
    finally:
        _pending_actions.pop(room_name, None)
        await http_session.close()


if __name__ == "__main__":
    agents = _load_livekit_runtime()
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
