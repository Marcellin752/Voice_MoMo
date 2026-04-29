/** Voice orchestrator — entrypoint for React Native (port 5004). */
import cors from "cors";
import express from "express";
import multer from "multer";
import { checkUpstreamHealth, processVoicePipeline } from "./voiceFlow.js";

const PORT = Number(process.env.PORT) || 5004;
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.get("/health", async (_req, res) => {
  try {
    const h = await checkUpstreamHealth();
    res.json(h);
  } catch (e) {
    res.status(500).json({ error: "health_failed" });
  }
});

function handleVoice(req, res) {
  const run = async () => {
    const file = req.file;
    if (!file || !file.buffer) {
      res.status(400).json({ error: "audio file required (field: audio)" });
      return;
    }
    const userId = String(req.body.userId || "");
    const sessionId = String(req.body.sessionId || "");
    const authHeader = req.headers.authorization || "";

    const out = await processVoicePipeline({
      audioBuffer: file.buffer,
      filename: file.originalname,
      mime: file.mimetype,
      userId,
      sessionId,
      authHeader,
    });

    res.json({
      status: out.status,
      audioBase64: out.audioBase64,
      sessionId: out.sessionId,
      transcript: out.transcript,
      intent: out.intent,
      error: out.error,
    });
  };

  const t = setTimeout(() => {
    if (!res.headersSent) res.status(504).json({ error: "timeout" });
  }, 60_000);

  run()
    .catch((e) => {
      console.error("Voice pipeline error:", e);
      if (!res.headersSent) res.status(500).json({ error: String(e?.message || e) });
    })
    .finally(() => clearTimeout(t));
}

app.post("/voice/command", upload.single("audio"), handleVoice);
app.post("/voice/confirm", upload.single("audio"), handleVoice);

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "orchestrator",
      level: "info",
      message: "listening",
      port: PORT,
    })
  );
});
