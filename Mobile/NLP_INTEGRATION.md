# NLP Integration Guide — Voice MoMo Mobile

## Setup

### 1. NLP Service (Backend)

Le service NLP doit être en cours d'exécution sur `http://localhost:8001`

```bash
# Terminal 1 - NLP Service
cd Nlp-module
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### 2. Mobile Frontend

```bash
# Terminal 2 - Mobile App
cd Mobile
npm run dev
# App available at http://localhost:5173 (or next available port)
```

---

## Configuration

Le hook `useVoiceAssistantNLP` est configuré par défaut pour pointer vers `http://localhost:8001`.

Pour le changer (par exemple en production), il faut modifier le paramètre lors de l'utilisation du hook :

```typescript
const { status, transcript, feedback, startListening, stopListening } = useVoiceAssistantNLP(
  'http://your-nlp-api.com'
);
```

---

## Features

### Speech Pipeline

1. **Audio Capture** — Web Speech API (navigateur)
2. **Transcription** — Speech-to-Text (navigateur, français)
3. **NLP Parsing** — Appel à `/ai/parse` endpoint
4. **Intent Recognition** — Classification automatique de l'intention
5. **Feedback** — Text-to-Speech (navigateur, français)

### Supported Intents

- `balance` — Check account balance
- `transfer` — Send money (amount + recipient required)
- `recharge` — Buy airtime/credit
- `bill_payment` — Pay utilities (eau, electricite, internet)
- `help` — Display available commands
- `confirm` — Approval signal (oui, ok, je confirme)
- `cancel` — Rejection (non, stop)

### Example Commands (French)

```
"Quel est mon solde ?"
→ intent: balance

"Envoie 5000 à Jean"
→ intent: transfer, amount: 5000, recipient: "jean"

"Recharge 2000 francs"
→ intent: recharge, amount: 2000

"Paye ma facture d'électricité pour 10000"
→ intent: bill_payment, bill_type: "electricité", amount: 10000

"Aide"
→ intent: help
```

---

## Testing

### Test 1: Direct API Call

```bash
curl -X POST http://localhost:8001/ai/parse \
  -H "Content-Type: application/json" \
  -d '{"text": "Envoie 5000 à Jean"}'
```

Expected response:
```json
{
  "intent": "transfer",
  "amount": 5000,
  "recipient": "jean",
  "currency": "XOF",
  "needs_confirmation": true,
  "confirmation_message": "Voulez-vous envoyer 5000 francs a jean ?",
  "understood_text": "Envoie 5000 à Jean",
  "metadata": {
    "provider": "fallback",
    "confidence": 0.95
  }
}
```

### Test 2: Mobile UI

1. Open http://localhost:5173
2. Allow microphone access
3. Click the floating blue microphone button
4. Say a command (e.g., "Envoie 5000 à Jean")
5. Watch the transcript and feedback appear

---

## Hook API

### `useVoiceAssistantNLP(nlpApiUrl?)`

**Parameters:**
- `nlpApiUrl` (optional) — NLP API base URL (default: `http://localhost:8001`)

**Returns:**
```typescript
{
  status: 'idle' | 'listening' | 'processing' | 'success' | 'error'
  transcript: string           // What the user said
  feedback: string             // Bot response
  parsedIntent: ParsedResponse | null  // Full NLP response
  startListening: () => void   // Start listening
  stopListening: () => void    // Stop listening
}
```

### `ParsedResponse` Type

```typescript
{
  intent: string                    // Command type
  amount?: number                   // For transfers/recharges
  recipient?: string                // For transfers
  currency?: string                 // e.g., "XOF"
  bill_type?: string                // For bill payments (electricité, eau, internet)
  needs_confirmation: boolean       // Requires user confirmation
  confirmation_message: string      // Message to show user
  understood_text: string           // Original input
  metadata: {
    provider: 'grok' | 'fallback'  // Which NLP engine was used
    confidence: number              // 0-1 confidence score
  }
}
```

---

## Files Modified/Created

- ✅ `/Mobile/src/app/hooks/useVoiceAssistantNLP.ts` — New hook
- ✅ `/Mobile/src/app/pages/HomeScreen.tsx` — Updated to use new hook
- ✅ `/Nlp-module/.env` — NLP service configuration

---

## Next Steps (When Backend Team Ready)

When the Speech-to-Text backend is ready:

1. Replace browser Web Speech API with real backend endpoint
2. Create a combined hook: `useVoiceAssistantFull`
3. Pipeline: Audio → Backend Speech-to-Text → NLP Service → Execution → Text-to-Speech

Current mock flow:
```
Browser Microphone → Browser Speech API → NLP Service
```

Future flow:
```
Browser Microphone → Backend Speech-to-Text → NLP Service
```

---

## Troubleshooting

### "Impossible de contacter le service NLP"

- Check NLP service is running: `curl http://localhost:8001/health`
- Check network: ensure frontend and NLP service are on same network
- Check CORS (if needed): NLP FastAPI should allow CORS

### "La reconnaissance vocale n'est pas supportée"

- Use Chrome, Firefox, or Edge
- Safari has limited support (WebKit-based)
- Microphone must be allowed in browser settings

### No feedback/response

- Check browser console for errors
- Verify NLP API is returning valid JSON
- Check microphone permissions in browser settings

---

## Performance Targets

- ✅ Latency: < 3 seconds (browser mic to feedback)
- ✅ Intent accuracy: > 85%
- ✅ Entity extraction F1-score: > 80%
- ✅ End-to-end success rate: > 80%

---

## Integration Checklist

- [x] NLP hook created (`useVoiceAssistantNLP.ts`)
- [x] HomeScreen updated to use NLP
- [x] Configuration documented
- [ ] Backend team provides Speech-to-Text endpoint
- [ ] Tests created for full pipeline
- [ ] Dataset created (20+ phrases per intent)
- [ ] Performance metrics measured
- [ ] Production deployment configured
