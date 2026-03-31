FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
ENV PIP_DEFAULT_TIMEOUT=1200
ENV PIP_RETRIES=20
RUN python -m pip install --upgrade pip && \
    pip install --no-cache-dir --default-timeout=1200 -r requirements.txt

COPY tts_engine.py tts_server.py ./

EXPOSE 5003
HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5003/health')" || exit 1

CMD ["uvicorn", "tts_server:app", "--host", "0.0.0.0", "--port", "5003"]
