# CLAUDE.md — Voice MoMo

Commercial, money-adjacent product with an established codebase and live Render deployments.
**Understand first. Change only when justified.** Where this file conflicts with a default
behavior (including default commit/PR attribution), this file wins.

The git root is this directory (`Voice_MoMo/`). The parent folder is NOT in git and holds loose
investor docs, test reports and stray venvs — never treat those as a source of truth.

## Product intent

Voice-only mobile money for people outside the digital world (illiterate, elderly, visually
impaired) in Bénin (MTN MoMo, French). Success means someone who cannot read or type can finish
a money operation unaided. Judge changes against that, not against technical polish. Today the
recharge/withdraw/bill/forfait intents only open the USSD menu (the user must read the screen),
and the dictated-PIN step was replaced by a touch keypad (merged from `origin/main` on 2026-10-31, not
yet reviewed — see `DECISIONS.md` ADR-0012). Do not describe either as end-to-end voice.

## Architecture (what is live vs dormant)

| Component | Path | Role |
|---|---|---|
| Mobile | `apps/mobile` | React + Vite + Capacitor → Android. Orchestrates voice, runs USSD **on the user's handset**. |
| Native plugins | `apps/mobile/android/app/src/main/java/com/voicemomo/app` | `UssdBackgroundNativePlugin` (TelephonyManager USSD / ACTION_CALL), `UssdAccessibilityService`, `SmsReaderPlugin`. |
| Backend, **live** | `apps/backend/legacy` (JS) | `/api/auth`, `/users`, `/transactions`, `/voice`, `/mmi` — what the app calls. Raw `pg`, bcrypt, JWT. |
| Backend, **dormant** | `apps/backend/src` (TS) | `/api/v1/*`, BullMQ, Prisma, modem pool, Socket.IO. The mobile app never calls it; Render runs it with `USE_MOCK_MODEM=true`. |
| NLP | `apps/nlp` | FastAPI. Audio → Gemini REST (STT+NLU in one call) → intent JSON; in-memory pending-transaction cache. |

- **Real money path:** `useVoiceAssistantNLP.ts` → `VoiceIntentProcessor.ts` → `MoMoTransactionEngine.ts`
  → native USSD (`*880*…`). Transfers run on the user's SIM. Servers do not move money.
- **Server `balance` / ledger is a client-reported mirror**, not a source of truth.
- JWT secret is shared by backend and NLP (`render.yaml`). Backend claims `userId`; NLP accepts
  `userId` or `user_id`. Changing claims or the secret scheme is a cross-service contract change.
- Backend error shape is `{ error }` (legacy) / `{ error, code }` (v1). Only MTN Bénin numbers are
  supported (`utils/authUser.ts`). Currency is FCFA/XOF.
- Dead code (no live importers): `hooks/useVoiceAssistant.ts`, `services/voiceAI.ts`,
  `services/voice.service.ts`. Do not delete without approval; do not build on them.

## Commands (verified unless marked)

Run from the stated directory.

- Backend `apps/backend`: `npx tsc --noEmit` (typechecks `src/` only — `legacy/` is not
  typechecked) and `npm test` (Jest, 26 tests: `src/` plus the legacy OTP and PIN-login flow).
- NLP `apps/nlp`: `venv/bin/python -m pytest -q -p no:cacheprovider tests/` (54 tests). `tests/conftest.py`
  sets a test `JWT_SECRET` and a dummy `GEMINI_API_KEY` by default, so the real key in `apps/nlp/.env`
  is never used (the tests still make outbound requests, with the dummy key). The service itself needs
  `JWT_SECRET` (same value as the backend) and refuses to start without it; the mock endpoints
  (`/api/auth/token|login|register`, `/api/users/profile|balance`, `/api/transactions`) exist only with
  `ENABLE_TEST_ENDPOINTS=true` (local development only). Gemini calls verify TLS; behind a TLS-inspecting
  proxy set `REQUESTS_CA_BUNDLE` to its CA bundle — never disable verification. `tests/test_voice_pipeline.py` is a manual script,
  excluded by `conftest.py`.
- Mobile `apps/mobile`: `npm test` (plain Node ≥ 22.18, no dependency; 7 tests, `src/app/utils/api.ts`
  only) and `npm run build` (Vite; verified 2026-10-31 with `--outDir` pointed at a temporary directory
  so the project's `dist/` is not overwritten). There is still **no** lint or typecheck setup and no `tsconfig`.
- Run locally: see `docs/LAUNCH_GUIDE.md` and `start_backend.sh`. Build APK: `docs/BUILD_APK.md`.
- Never load `legacy/config/db.js` with a non-local `DATABASE_URL`: it runs `CREATE TABLE IF NOT EXISTS`
  on import. Never run migrations or scripts against Render databases.

## 1. Understand before working

Before any substantial task: read this file; read the affected code (not just READMEs — some docs
are stale); read `PROJECT_STATUS.md`, the last `SESSION_LOG.md` entry and the open Critical/High items in
`TODO.md`; check `git status`, the current branch, and whether origin is ahead (`git ls-remote origin main`
vs `git rev-parse origin/main` — the local remote-tracking ref can be stale; don't pull, merge or
fetch unless asked, and say which commit you worked from); find existing implementations to reuse;
trace consumers and side effects across mobile ↔ backend ↔ NLP. A cleaner-looking alternative
implementation is not evidence that the existing one is unnecessary.

## 2. Preserve existing functionality

- No rewrites, speculative refactors, or architecture changes without justification and approval.
- No removal of functionality, silent business-rule changes, or breaking API changes without
  explicit approval. No new dependencies without approval. No edits to unrelated components.
- Prefer minimal, targeted, reversible changes. Before touching a shared component (e.g.
  `api.ts`, `MoMoTransactionEngine.ts`, `auth.service.js`, `action_executor.py`), list its consumers.
- "Don't introduce dead code" means don't add unused code; it is not a licence to delete existing code.

## 3. Code quality

- Match surrounding conventions, naming and language (user-facing strings and TTS copy are French;
  comments in this repo are mixed French/English — follow the file).
- Handle errors explicitly; no silent catch-and-fallback in money, auth or storage paths.
- Validate types and ranges (zod in `backend/src`, pydantic in NLP; `legacy/` is manual — new
  code there must validate explicitly).
- Don't duplicate business logic. Success/failure keyword matching already exists in several
  places (`session-parser.ts`, `ussd-codes.config.ts`, `UssdAccessibilityService.java`,
  `MoMoTransactionEngine.ts`) — do not add another copy.
- No hardcoded secrets or environment-specific URLs. Don't suppress warnings/errors to pass checks.

## 4. Git and authorship

- Never add Claude/AI as co-author; no `Co-authored-by` or other AI-attribution trailers or
  "generated with" lines in commits.
- Never commit, push, amend, rebase, reset --hard, force-push, or rewrite history unless explicitly
  told to; never change git identity/config.
- Stage specific paths only (never `git add -A` / `.`). Before proposing a commit, inspect
  `git diff --staged` and report it.
- `.vscode/settings.json` has pre-existing uncommitted user changes — never stage or revert it.
- Branches `origin/mobile`, `origin/execute_mmi`, `origin/features/v1` hold unmerged commits; don't
  delete or merge them without approval.
