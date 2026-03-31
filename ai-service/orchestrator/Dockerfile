FROM node:20-bookworm-slim

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY index.js voiceFlow.js confirmationManager.js pinEncrypt.js ./

EXPOSE 5004
ENV STT_URL=http://stt-service:5001
ENV NLU_URL=http://nlu-service:5002
ENV TTS_URL=http://tts-service:5003
ENV BACKEND_URL=http://host.docker.internal:3001

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5004/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
