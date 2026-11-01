# DECISIONS — Architecture Decision Records

Only meaningful decisions (architecture, data, dependencies, API contracts, auth, payments, integrations, security, business rules). Append new ADRs; to change one, add a new ADR and mark the old one `superseded by ADR-NNNN` — don't rewrite the old text.

**Retroactive records (ADR-0001…0011):** written 2026-10-31 from code and git history. The *date* is the earliest evidence in git (commit subjects quoted); the *reasoning* is stated only where a commit/doc/comment states it, otherwise marked "not recorded" or "inferred". Statuses: proposed · accepted · superseded · deprecated.

| ADR | Decision | Status |
|---|---|---|
| 0001 | Execute USSD on the user's handset via native Android plugins | accepted |
| 0002 | Mobile = React + Vite + Capacitor | accepted |
| 0003 | Gemini REST for STT+NLU; TTS on device | accepted |
| 0004 | Voice-only transaction UX (no touch input) | accepted — in tension with upstream keypad (0012) |
| 0005 | Contacts resolved on the device only | accepted |
| 0006 | Monorepo `apps/{mobile,backend,nlp}` | accepted |
| 0007 | Two backend codebases: `legacy/` (live) + `src/` v1 (dormant) | accepted de facto, under review (0013) |
| 0008 | Backend and NLP share one JWT secret/format | accepted |
| 0009 | OTP-only login, with dev conveniences left active | dev conveniences superseded by ADR-0015 (OTP-only login stands) |
| 0010 | Recharge/withdraw/bill/forfaits only open the USSD menu | accepted |
| 0011 | Server `balance` is a client-reported mirror | accepted |
| 0012 | How the MTN PIN is entered | **proposed** |
| 0013 | Fate of the dormant v1/modem/MMI stack | **proposed** |
| 0014 | Single schema/migration authority | **proposed** |
| 0015 | OTP development behaviours are opt-in (`ALLOW_DEV_OTP`) | accepted (2026-10-31) |
| 0016 | The default PIN `0000` never opens a session by PIN | accepted (2026-10-31) |
| 0017 | NLP test endpoints are opt-in; JWT required; no default JWT secret | accepted (2026-10-31) |
| 0018 | Gemini calls: key in a header, TLS verified, sanitized errors | accepted (2026-10-31) — part 1; part 2 via 0019 |
| 0019 | Apply ADR-0018 to the `/ai/parse` Gemini client | accepted (2026-10-31) |
| 0020 | Voice print is learned passively on device (no phrase enrollment) | accepted (2026-10-31) |
| 0021 | Homonym picker is tappable; TTS speaks first name + last 4 digits | accepted (2026-10-31) |

---

### ADR-0001 — USSD executed on the user's handset
- **Date:** earliest evidence 2026-05-11 ("native Android USSD handling via Accessibility Service"), 2026-05-15 ("use executeDirectCall…"). **Status:** accepted.
- **Context:** transfers must run on the user's own MTN SIM and account.
- **Decision:** Android plugins drive USSD (`UssdBackgroundNativePlugin`, `UssdAccessibilityService`, ACTION_CALL fallback); servers do not move money.
- **Alternatives:** server-side GSM modem pool — built (`apps/backend/src`, added 2026-03-28 in commit "we add the USSD ligic"; NLP bridge `execute-sync` added 2026-05-09) but runs mock-only (ADR-0013). It predates the on-device approach by about six weeks, so the on-device path may have superseded it in practice; the reason is not recorded.
- **Reasoning:** not recorded; inferred — no custody of funds or PINs on servers.
- **Consequences:** no server-side source of truth for transaction outcomes; success must be classified on the client (T-007); device testing is mandatory; the accessibility service is a privileged surface (T-008).

### ADR-0002 — React + Vite + Capacitor
- **Date:** 2026-03-24 ("Add Android APK build: Capacitor"). History: Flutter setup 2026-03-16 → "Delete old project and restart with react native" 2026-03-18 → Capacitor 2026-03-24. **Status:** accepted.
- **Alternatives:** Flutter, React Native (both attempted per commits). **Reasoning:** not recorded.
- **Consequences:** WebView app with Java plugins for USSD/SMS/accessibility; web-style storage (localStorage) holds tokens (T-017); no typed build (T-024).

### ADR-0003 — Gemini REST for STT+NLU, on-device TTS
- **Date:** 2026-03-24 ("NLP Module Complete: Gemini Voice Integration"), 2026-03-29 ("Gemini REST API"). **Status:** accepted.
- **Alternatives seen in history:** xAI Grok/LiveKit voice branch (removed as dead 2026-06-18); Google Cloud STT/TTS (still named in README, not in code). **Reasoning:** the REST service's docstring says REST avoids gRPC certificate problems.
- **Consequences:** user audio leaves the device; quota/503 handling added 2026-09-02; TLS verification currently disabled and key in URL (T-004).

### ADR-0004 — Voice-only transaction UX
- **Date:** 2026-06-21 (CAHIER §8 "Aucune saisie tactile pour transferts, PIN, confirmation ou choix de contact"; commit "remove manual transaction screens"). **Status:** accepted.
- **Reasoning:** serves the inclusion goal (users who cannot read or type).
- **Consequences:** originally forced PIN dictation (0012). Upstream `cc5d088` (2026-09-12) adds a touch PIN keypad, contradicting the written requirement until 0012 is decided.

### ADR-0005 — Contacts resolved on the device only
- **Date:** 2026-06-17 ("stop hardcoding recipient phone numbers; resolve contacts on device"). **Status:** accepted.
- **Reasoning (in code, `action_executor.py` `_normalized_recipient`):** the server cannot see the user's address book; a hard-coded server table sent money to the wrong number ("papa → numéro inconnu").
- **Consequences:** matching thresholds (0.85 / gap 0.15, `ContactResolverService.ts`) are business rules; the NLP `contacts` sync is separate.

### ADR-0006 — Monorepo layout
- **Date:** 2026-06-18 ("migrate to apps/ monorepo layout"). **Status:** accepted. **Reasoning:** not recorded. **Consequence:** the old `Mobile/`, `Backend/`, `NLP/` paths survive in some docs and scripts.

### ADR-0007 — Two backend codebases
- **Date:** legacy JS services from 2026-03-18; the TS v1 `src/` stack and the `legacy/` folder layout were added together on 2026-03-28 ("we add the USSD ligic"; the Backend folder had been recovered from branch `execute_mmi` on 2026-03-27). **Status:** accepted de facto; under review (0013).
- **Context/decision:** `src/index.ts` mounts `legacy/` routes next to `/api/v1/*`; the mobile app only calls `legacy/`.
- **Consequences:** two validation styles, two data-access layers (raw `pg` vs Prisma), three schema sources (0014).

### ADR-0008 — Shared JWT secret
- **Date:** 2026-05-08 ("JWT compatibility with Node.js backend"); strict enforcement 2026-09-02. **Status:** accepted.
- **Decision:** backend issues JWTs; NLP verifies with the same secret (`render.yaml` links them); backend claim `userId`, NLP accepts `userId` or `user_id`.
- **Consequences:** one secret compromises both services; changing claims is a cross-service contract change (see `CLAUDE.md`).

### ADR-0009 — OTP-only login with dev conveniences
- **Date:** OTP via Twilio/Termii 2026-05-17; on-screen OTP when SMS fails 2026-05-17 ("trial account fallback"); `000000` bypass 2026-05-18 (commit says "DEV bypass"). **Status:** accepted as temporary; flagged for supersession.
- **Context:** CAHIER §4.1 specifies OTP login (the MTN PIN is not used at login); SMS providers were on trial accounts.
- **Consequences:** the conveniences are still active in production code and the repo is public (T-001). A demo mechanism must replace them before removal.

### ADR-0010 — Menu-open USSD for non-transfer services
- **Date:** 2026-06-21 ("handle recharge, withdraw and bill payment via voice"). **Status:** accepted.
- **Decision:** these intents dial `*880#`-family menus and tell the user to follow the screen; only transfer and balance build full strings.
- **Reasoning:** lower risk than automating multi-step menus.
- **Consequences:** breaks the inclusion goal for users who cannot read the screen (T-027).

### ADR-0011 — Server balance is a mirror
- **Date:** 2026-05-11 ("parse real solde from sms with plugin and sync with backend"). **Status:** accepted.
- **Decision:** the app reads the balance from MTN SMS/USSD and POSTs it to `/api/users/balance`.
- **Consequences:** the server number is not authoritative and must not drive decisions (T-013).

---

### ADR-0012 — How the MTN PIN is entered (PROPOSED)
- **Date:** proposed 2026-10-31. **Status:** proposed — **owner decision required.**
- **Context:** CAHIER requires no touch input and a dictated PIN. Local clone: dictated audio is uploaded to NLP/Gemini, transcribed, never delivered to USSD, and USSD-with-PIN strings are logged natively. Upstream: touch keypad + voice biometrics, claimed "PIN never spoken or sent to NLP" (unverified).
- **Options:** (A) on-device digit recognition only, nothing uploaded; (B) keep cloud STT with TLS verified, no logging — still sends the credential to a third party; (C) system/secure keypad, accessible via TalkBack; (D) A or C plus injection into the USSD dialog, restricted to the phone package (T-008).
- **Leaning (to validate on devices):** A or C with D; B rejected on credential-exposure grounds. Cost: digit accuracy in noise; keypad departs from ADR-0004 and needs the CAHIER updated.
- **Consequences if accepted:** T-003 scope fixed; CAHIER §4.1/§8 revised; biometric gating (upstream) reviewed.

### ADR-0013 — Fate of the dormant v1/modem/MMI stack (PROPOSED)
- **Date:** proposed 2026-10-31. **Status:** proposed.
- **Context:** `apps/backend/src` (~1.9k lines) and `/api/mmi/*` have no mobile caller; Render runs them with `USE_MOCK_MODEM=true`; `execute-sync` is called only by NLP when `BACKEND_ACTION_URL` is set (not set in `render.yaml`).
- **Options:** keep and finish with hardware tests and the T-009 fixes; park (disable routes/Redis, keep code); remove.
- **Consequences:** drives T-009, T-014, T-015, T-021 and the Redis/Bull Board footprint. Removal needs explicit approval.

### ADR-0014 — Schema/migration authority (PROPOSED)
- **Date:** proposed 2026-10-31. **Status:** proposed.
- **Context:** runtime DDL in `db.js` (added 2026-05-17 for Neon), an unapplied `schema.sql`, and Prisma covering two tables; production DB provider unknown.
- **Options:** Prisma owns all tables (introspect the live schema); versioned SQL migrations for everything; keep runtime DDL (rejected: no history, no rollback).
- **Consequences:** drives T-006; needs a baseline against a copy of the live schema before any change.

### ADR-0015 — OTP development behaviours are opt-in
- **Date:** 2026-10-31 (owner approval: "oui vas-y pour A"). **Status:** accepted. Supersedes the "dev conveniences left active" part of ADR-0009; OTP-only login itself stands.
- **Context:** the test code `000000` (2026-05-18) and the OTP returned in the API response when SMS fails (2026-05-17) were added for development and Twilio trial accounts, but stayed active in production code. The repo is public and Render sets no SMS provider, so any phone number could be logged into (T-001).
- **Decision:** both behaviours work only when `ALLOW_DEV_OTP=true` (default off; `legacy/services/auth.service.js`). By default an SMS failure returns HTTP 503 and the code is never returned or logged.
- **Alternatives:** gate on `NODE_ENV` (rejected: Render runs `production` yet the intent is an explicit opt-in, and tests need control); delete the behaviours (rejected: demos and development without an SMS provider would lose their only path); a seeded demo account behind a flag (deferred — not needed while the flag exists).
- **Consequences:** login requires a configured SMS provider (Twilio or Termii) in any environment that does not set the flag; local development without a provider needs `ALLOW_DEV_OTP=true` in its own `.env` (untouched); the app's `devCode` display branch is dead unless the flag is on; accounts created by OTP still carry the default PIN `0000` (T-068, closed by ADR-0016).

### ADR-0016 — The default PIN `0000` never opens a session by PIN
- **Date:** 2026-10-31 (owner chose option (a): "option a pour T-068"). **Status:** accepted.
- **Context:** accounts created by OTP are registered with the default PIN `0000` (`DEFAULT_OTP_PIN`). `POST /api/auth/login` accepted it, so anyone could obtain a session for any OTP-created account without an OTP. **[Ran]** pinned by a test before the fix. The endpoint has no caller in the mobile app but is reachable and unthrottled (T-005).
- **Decision:** `login()` refuses PIN `0000` with the same 401 "PIN incorrect." as a wrong PIN, before any account lookup, so the response reveals nothing about which accounts are on the default PIN. `updatePin` is unchanged: it verifies the old PIN directly, so changing the PIN from `0000` still works.
- **Alternatives:** (b) a random unusable PIN hash for OTP accounts — rejected, it breaks the old-PIN prompt of the PIN screen; (c) disable `/api/auth/login` and `/api/auth/register` — not chosen, nothing in the app calls them but removal is a larger behaviour change; a distinct, explanatory error — rejected, it would act as an oracle for default-PIN accounts.
- **Consequences:** a user who deliberately sets `0000` as a personal PIN cannot PIN-login (OTP login is unaffected); PIN-login brute force on personal PINs is still unthrottled (T-005); registering via `/api/auth/register` with `0000` creates an account that cannot PIN-login.

### ADR-0017 — NLP test endpoints are opt-in; JWT required; no default JWT secret
- **Date:** 2026-10-31 (owner: "continue", after the T-002 recommendation). **Status:** accepted.
- **Context:** the NLP service issued JWTs to anyone (`/api/auth/token`, `/login`, `/register`), exposed mock profile/balance/transaction data keyed by a caller-supplied `user_id`, let `/api/cancel`, `/api/users/contacts` and `/api/pending-transactions` fall back to the shared `default` user, and defaulted to a public JWT secret. The `.env.example` flags meant to guard this (`ENABLE_TEST_TOKEN_ENDPOINT`, `ALLOW_UNAUTHENTICATED`) were never read. The mobile app calls none of those endpoints on the NLP service (its login goes to the backend).
- **Decision:** (1) the seven test endpoints answer 404 unless `ENABLE_TEST_ENDPOINTS=true` (read on each request); (2) `cancel`, `contacts` and `pending-transactions` require a JWT and take the identity from it — byte-identical to the fix already on `origin/main` `3696121`, verified to merge cleanly; (3) `app.auth` raises at import when `JWT_SECRET` is unset.
- **Alternatives:** delete the mock endpoints (rejected: removal needs approval and they remain useful for local development); require a JWT on them and derive identity from it (rejected: larger behaviour change, and their purpose is token-less local use); gate on `NODE_ENV` (rejected, as in ADR-0015).
- **Consequences:** the NLP service will not start without `JWT_SECRET`, which must equal the backend's (the Render blueprint links them; a local `apps/nlp/.env` needs it); `docs/nlp/README_PRODUCTION.md` curl examples need the flag; `/ai/parse` is still unauthenticated (T-016) and users still share state in the in-memory store (T-050); the two never-read example flags were replaced by `ENABLE_TEST_ENDPOINTS`; `tests/conftest.py` now makes the NLP tests hermetic (test secret, dummy Gemini key).

### ADR-0018 — Gemini calls: key in a header, TLS verified, sanitized errors
- **Date:** 2026-10-31 (owner: "continue", after the T-004 mention). **Status:** accepted for the voice/audio path (`gemini_rest_service.py`); the `/ai/parse` client is pending the upstream merge (T-004 part 2).
- **Context:** the voice path disabled TLS verification in three places (a global `session.verify = False`, a per-request `verify=False`, and `urllib3.disable_warnings()`), put the API key in the URL query string, and returned raw exception text to clients. `requests` connection errors embed the full URL, so failures logged the key at WARNING level and could return it in the response. The comment history ("Web Filter 403", "SSL bypass") shows verification was disabled to cope with a filtering network.
- **Decision:** verification is on and cannot be switched off by configuration; the key travels in `x-goog-api-key`; log text goes through `_scrub()`; failures return fixed, user-safe messages while details stay in server logs; the 500 handler of `/api/voice-command` no longer echoes the exception.
- **Alternatives:** honour the existing but unused `settings.disable_ssl_verify` (rejected: an insecure switch for a credential-bearing request; the standard `REQUESTS_CA_BUNDLE` / `SSL_CERT_FILE` covers inspecting proxies); keep the key in the URL and only redact (rejected: it also appears in intermediary logs).
- **Consequences:** developers behind a TLS-inspecting network must point `REQUESTS_CA_BUNDLE` at their CA bundle (`start_backend.sh` already exports certifi's bundle when `.env` exists); the Gemini key may sit in historical Render logs and should be rotated after deploying; `gemini_client.py` keeps the key in the URL until its call lines can be edited on top of upstream's retry loop.

### ADR-0019 — Apply ADR-0018 to the `/ai/parse` Gemini client
- **Date:** 2026-10-31 (owner: "fixe et corrige tout ce qui ne fonctionne pas encore"). **Status:** accepted.
- **Context:** T-004 part 2. `gemini_client.py` still put `?key=` in the URL and re-raised `str(e)` (which embeds the URL). The voice path already followed ADR-0018; `/ai/parse` did not. Exceptions are swallowed by `service.parse` (fallback parser), so nothing leaked to HTTP responses, but the key still sat in the request URL.
- **Decision:** keep the upstream 429/503 retry loop; send the key in `x-goog-api-key`; URL has no query key; failures raise a fixed French message with no exception text. 3 tests in `test_gemini_transport.py` failed on the unfixed code, then passed.
- **Consequences:** same as ADR-0018. Key rotation on Render (HANDOFF B8) is still owed. `/ai/parse` remains unauthenticated (T-016).

### ADR-0020 — Passive on-device voice print (no enrollment phrases)
- **Date:** 2026-10-31 (owner: do not ask the user to record phrases; learn like Siri). **Status:** accepted.
- **Context:** the enrollment screen's "Enregistrer cette phrase" path was unreliable, and a dedicated enrollment step blocks the target users. Upstream required an enrolled template before any sensitive operation.
- **Decision:** embeddings are learned from normal command audio on the device (`learnFromUserSpeech`). Until `LEARNING_MIN_SAMPLES` (3) the gate lets the operation through and keeps learning. After that, the command audio is verified; a live phrase challenge is only used if that check fails. Settings shows status/journal, not an enrollment wizard. PIN stays on the keypad (ADR-0012).
- **Consequences:** during the first few utterances any speaker on that phone can contribute to the template **[Claimed, not device-tested]**. Embeddings remain in `StorageService` (unencrypted — T-017). Device behaviour is T-072.

### ADR-0021 — Homonym list is tappable; spoken names use a safe form
- **Date:** 2026-10-31 (owner: tap the right homonym; do not mispronounce names). **Status:** accepted. In tension with ADR-0004 (no touch for contact choice).
- **Context:** several contacts can share a first name; the modal had become display-only (`pointer-events-none`) and `resolveAmbiguity` was not wired. On-device TTS mangles many Beninese names.
- **Decision:** the list is a button per contact (`onSelect` → `resolveAmbiguity`); voice selection (say 1, 2, 3…) remains. Confirmation **displays** the full name and **speaks** first name + last 4 digits spaced (`formatContactForSpeech`). NLP `audio_base64` is not used for that confirmation.
- **Consequences:** a user who cannot see the screen can still say the number; a user who cannot parse the spoken list can tap. Device behaviour is T-072.

### ADR-0022 — "Code on screen" fallback without the `000000` bypass (demo switch)
- **Date:** 2026-11-01 (owner: Twilio trial refuses to verify Bénin numbers; presentation at 17:00). **Status:** accepted as a temporary demo measure; superseded the day a working SMS provider is configured (then the variable must be removed).
- **Context:** since T-001 (ADR-0015) a failed SMS returns 503 and the only way to see the code was `ALLOW_DEV_OTP=true`, which also accepts `000000` for any number. Twilio in trial mode cannot verify a caller ID in Bénin ("restricted country"), so no SMS can leave for the owner's own number.
- **Decision:** a second variable, `SHOW_OTP_WHEN_SMS_FAILS=true`, makes `sendOtp` return `devCode` (shown by `LoginScreen`) when the provider fails or none is configured, **without** enabling the `000000` bypass. 4 tests in `legacy-auth-otp.test.ts`.
- **Consequences:** while it is set, anyone who knows a phone number can log in as that number (the code is displayed to whoever asked). Acceptable for a supervised demo only. Real fix: a provider that delivers to Bénin (paid Twilio with Benin enabled in Geo Permissions, or a local provider), then remove the variable.
