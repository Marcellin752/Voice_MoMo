import asyncio
import logging
import os
from contextlib import suppress

import sounddevice as sd
from dotenv import load_dotenv
from livekit import api, rtc

from app.config import settings

load_dotenv()

logger = logging.getLogger("voice-momo-local-audio-client")
logging.basicConfig(level=logging.INFO)

SAMPLE_RATE = 48000
CHANNELS = 1
BLOCKSIZE = 480  # 10 ms @ 48kHz


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


async def _publish_mic(room: rtc.Room) -> tuple[rtc.AudioSource, asyncio.Queue, sd.RawInputStream, asyncio.Task]:
    source = rtc.AudioSource(SAMPLE_RATE, CHANNELS)
    track = rtc.LocalAudioTrack.create_audio_track("laptop-mic", source)
    await room.local_participant.publish_track(track)

    queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=200)

    def mic_callback(indata, frames, time_info, status):
        if status:
            logger.debug("Mic status: %s", status)
        payload = bytes(indata)
        try:
            queue.put_nowait(payload)
        except asyncio.QueueFull:
            pass

    mic_stream = sd.RawInputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype="int16",
        blocksize=BLOCKSIZE,
        callback=mic_callback,
    )
    mic_stream.start()

    async def pump_audio():
        while True:
            payload = await queue.get()
            samples_per_channel = len(payload) // (2 * CHANNELS)
            frame = rtc.AudioFrame(
                data=payload,
                sample_rate=SAMPLE_RATE,
                num_channels=CHANNELS,
                samples_per_channel=samples_per_channel,
            )
            await source.capture_frame(frame)

    task = asyncio.create_task(pump_audio())
    return source, queue, mic_stream, task


def _play_remote_track(track: rtc.Track, participant_identity: str) -> asyncio.Task:
    async def run():
        if not isinstance(track, rtc.RemoteAudioTrack):
            return

        logger.info("Subcribed to remote audio from %s", participant_identity)
        stream = rtc.AudioStream.from_track(
            track=track,
            sample_rate=SAMPLE_RATE,
            num_channels=CHANNELS,
        )

        out = sd.RawOutputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype="int16",
            blocksize=BLOCKSIZE,
        )
        out.start()

        try:
            async for ev in stream:
                out.write(memoryview(ev.frame.data).cast("B"))
        finally:
            out.stop()
            out.close()
            await stream.aclose()

    return asyncio.create_task(run())


async def main() -> None:
    room_name = os.getenv("LIVEKIT_ROOM", "voice-momo-local")
    identity = os.getenv("LIVEKIT_CLIENT_IDENTITY", f"laptop-user-{os.getpid()}")

    if not settings.livekit_url:
        raise RuntimeError("LIVEKIT_URL is required")

    token = _build_token(room_name, identity)

    room = rtc.Room()
    playback_tasks: set[asyncio.Task] = set()

    @room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        task = _play_remote_track(track, participant.identity)
        playback_tasks.add(task)
        task.add_done_callback(lambda t: playback_tasks.discard(t))

    await room.connect(settings.livekit_url, token)
    logger.info("Local audio client connected to room: %s", room_name)

    source, queue, mic_stream, pump_task = await _publish_mic(room)
    logger.info("Microphone publishing started. Speak now. Press Ctrl+C to stop.")

    stop_event = asyncio.Event()
    try:
        await stop_event.wait()
    except KeyboardInterrupt:
        logger.info("Stopping local audio client...")
    finally:
        pump_task.cancel()
        with suppress(asyncio.CancelledError):
            await pump_task
        mic_stream.stop()
        mic_stream.close()
        await source.aclose()

        for task in list(playback_tasks):
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

        await room.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
