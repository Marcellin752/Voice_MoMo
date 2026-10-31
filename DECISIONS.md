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

