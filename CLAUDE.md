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
  typechecked) and `npm test` (Jest, 30 tests: `src/` plus the legacy OTP and PIN-login flow).
- NLP `apps/nlp`: `venv/bin/python -m pytest -q -p no:cacheprovider tests/` (57 tests). `tests/conftest.py`
  sets a test `JWT_SECRET` and a dummy `GEMINI_API_KEY` by default, so the real key in `apps/nlp/.env`
  is never used (the tests still make outbound requests, with the dummy key). The service itself needs
  `JWT_SECRET` (same value as the backend) and refuses to start without it; the mock endpoints
  (`/api/auth/token|login|register`, `/api/users/profile|balance`, `/api/transactions`) exist only with
  `ENABLE_TEST_ENDPOINTS=true` (local development only). Gemini calls verify TLS; behind a TLS-inspecting
  proxy set `REQUESTS_CA_BUNDLE` to its CA bundle — never disable verification. `tests/test_voice_pipeline.py` is a manual script,
  excluded by `conftest.py`.
- Mobile `apps/mobile`: `npm test` (plain Node ≥ 22.18, no dependency; 17 tests in `src/app/utils/*.test.ts`:
  `api.ts`, `nlpClient.ts`, `speakableName.ts`) and `npm run build` (Vite; verified 2026-10-31 with `--outDir` pointed at a temporary directory
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

## 5. Communication

- Explain consequential decisions; separate verified facts from assumptions; say plainly what is
  incomplete or untested. Never claim a USSD/device behavior works unless it was tested on a device.
- Don't ask what the repo can answer. **Ask first** before changing: amount limits, USSD strings,
  contact-matching thresholds, auth/OTP/PIN behavior, API contracts, deployment config, or anything
  that affects what a user is told about their money.

## 6. Task discipline

Substantial changes: understand the requirement → inspect existing code → identify affected
components → state expected behavior → define acceptance criteria → smallest change → verify →
review the diff → update the relevant doc. Trivial changes: skip the ceremony.

## 7. Money and business logic (adapted to this product)

- Treat all of this as high-risk. Never silently change monetary logic.
- **Truth of a transaction = MTN's response or MTN's confirmation SMS**, never frontend state, an
  NLP message, or keyword heuristics. "Unknown" is not "success". Never simulate success outside an
  explicit demo mode.
- Never auto-retry a transfer; prevent double submission. Known gap: the engine's `USSD_IN_PROGRESS`
  guard is per instance and every flow creates a new engine (T-031) — don't rely on it.
- Do not change without approval: transfer bounds (100–500,000 FCFA, `VoiceIntentProcessor.ts`),
  USSD templates (`ussd-codes.config.ts`, `MoMoTransactionEngine.ts`, `InterNetworkTransferEngine.ts`),
  contact auto-accept thresholds (`ContactResolverService.ts`), MTN-only restriction.
- Keep `USE_MOCK_MODEM=true` unless a real modem deployment is explicitly authorized.
- Never log or upload PINs, OTPs, tokens, USSD strings containing a PIN, SMS bodies or phone
  numbers. Preserve traceability of transactions (ids, status, timestamps).
- Never write to production data or call deployed Render hosts with mutating requests.
- Flag races and consistency risks you notice (e.g. non-atomic ledger updates).

## 8. Security

- Never expose or hardcode secrets. `.env` files exist locally and are untracked (`apps/nlp/.env`
  holds real keys): don't print, commit, or copy values; redact when inspecting.
- New endpoints require auth: `legacy/middleware/auth.js` (backend) / `extract_user_from_request`
  (NLP). Derive the user from the token only, never from query/body.
- Don't weaken auth/TLS to simplify work or pass tests: no `verify=False`, no bypass codes,
  no unauthenticated fallbacks. API keys go in headers, not URLs. Don't return `str(exception)` to clients.
- Treat Gemini, SMS providers and MTN responses as untrusted input.
- Keep the AccessibilityService narrowly scoped; never broaden its events/packages or let it
  inject credentials outside the USSD dialog.
- Fail closed when a secret or key is missing; don't add fallback defaults.

## 9. Testing

- Run the relevant commands above after changes; never claim success unless they ran and passed.
- Don't delete tests or weaken assertions without justification. (The one NLP test that asserted the
  open token endpoint was changed deliberately for T-002; see `tests/test_auth_hardening.py`.)
- Covered only partly: `apps/backend/legacy` (the OTP and PIN-login flow only, `tests/unit/legacy-auth-otp.test.ts`).
  Not covered at all: all of `apps/mobile` except `api.ts` (`npm test`), all native Java. For
  changes there, state exactly what was and wasn't verified, and that USSD/accessibility behavior needs
  a device with an MTN SIM.
- Test edge cases (empty/invalid input, timeouts, duplicate submits, DB/Redis unavailable).

## 10. Documentation

Keep docs accurate and concise; edit existing files, don't create new ones unless asked. Link, don't
copy. The code is the source of truth; the reference docs below were not all re-verified:

- `README.md`, `docs/CAHIER_DES_CHARGES.md` — scope and USSD codes. README is partly stale (lists
  Google Cloud Speech/TTS; the code uses Gemini REST and on-device TTS). CAHIER §7–8 "✅" marks are
  self-reported, not verified — feature status lives in `PROJECT_STATUS.md`.
- `docs/LAUNCH_GUIDE.md`, `docs/BUILD_APK.md` — run and build.
- `apps/backend/MTN_USSD_ACTIONS.md`, `MMI_SERVICES.md`, `DOCUMENTATION.md` — USSD/backend reference.
- `docs/nlp/*` — NLP pipeline and action architecture.
- `apps/mobile/src/app/services/ARCHITECTURE_NOTES.md` — mobile service layout.

### Continuity system (each fact lives in exactly one file)

| File | Holds | Update when |
|---|---|---|
| `PROJECT_STATUS.md` | CURRENT state: maturity, module status, verified features, risks, next actions | the state changes (rewrite in place; keep it short) |
| `TODO.md` | Open work by priority, with IDs (`T-nnn`) and a completion criterion | a task is found, started, blocked or done (edit status in place) |
| `DECISIONS.md` | ADRs (`ADR-nnnn`): meaningful decisions only | a significant decision is proposed or made (append; supersede, never rewrite) |
| `SESSION_LOG.md` | Append-only history of sessions | the end of every significant session (append only) |
| `CHANGELOG.md` | User-visible changes: Added/Changed/Fixed/Removed/Security | a user-visible change is delivered (under Unreleased) |
| `HANDOFF_TESTS.md` | Verification still owed (automated, deployed services, device), with expected results; in French | a listed check is run (record the result in `SESSION_LOG.md` and the item's `TODO.md` status) or the plan changes |

Session protocol: **start** by reading `PROJECT_STATUS.md`, the last `SESSION_LOG.md` entry and the
open Critical/High items of `TODO.md`; **end** by appending a `SESSION_LOG.md` entry (what ran and
its result, what is outstanding, next action) and updating only the files whose facts changed.
Reference tasks/decisions by ID instead of restating them. Mark uncertain facts `[Unknown]` or
`[Claimed]`; never record a feature as working without evidence, and never invent history.

## Known hazards (unresolved — do not copy or extend; fix only under an approved plan)

Open defects exist in auth (no attempt limits, `/ai/parse` unauthenticated), PIN handling, the `/ai/parse` Gemini client (key in URL),
success reporting and storage — full list, evidence and completion criteria in `TODO.md` (T-001…).
Fixes are staged per phase because demos may depend on some of them. Don't build on these
patterns, and don't "fix" them opportunistically.
