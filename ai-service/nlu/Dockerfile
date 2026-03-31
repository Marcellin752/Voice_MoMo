FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY contact_resolver.py intent_parser.py nlu_server.py ./

EXPOSE 5002
ENV OLLAMA_URL=http://ollama:11434

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5002/health')" || exit 1

CMD ["uvicorn", "nlu_server:app", "--host", "0.0.0.0", "--port", "5002"]
