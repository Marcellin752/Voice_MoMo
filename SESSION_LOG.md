# SESSION_LOG — Voice MoMo

Chronological, **append-only** (oldest first, newest last). Never edit past entries; correct them with a new entry that says so.
History before 2026-10-30 is not reconstructed here: use `git log` (315 commits from 2026-03-16) and `CHANGELOG.md`.

Entry template: **Date · Objective · Work completed · Files modified · Decisions · Tests executed (command → result) · Problems · Outstanding · Next action.**

---

## 2026-10-30 — Read-only engineering audit
- **Objective:** understand the codebase and assess risk before any change.
- **Work completed:** audited repo, git, backend (`legacy/` + `src/`), NLP service, mobile app, native Java, CI/deploy config, docs. Findings were delivered in chat and are now captured in `TODO.md` / `PROJECT_STATUS.md`.
- **Files modified:** none in the repo. Outside it: agent memory notes; throwaway probe scripts in a temp scratchpad (not kept).
- **Decisions:** none recorded as ADRs. Working rules agreed: understand first, no commit/push, roadmap needs approval.
- **Tests executed:**
  - `apps/backend`: `npx --no-install jest --ci --silent` → 5 suites, 12 tests passed. `npx --no-install tsc --noEmit -p .` → no diagnostics printed.
  - `apps/nlp`: `GEMINI_API_KEY=dummy-key XAI_API_KEY=dummy JWT_SECRET=… venv/bin/python -I -m pytest -q -p no:cacheprovider tests/test_integration.py` → 20 passed (urllib3 `InsecureRequestWarning` for `generativelanguage.googleapis.com`, confirming `verify=False`).
  - In-process probe (FastAPI `TestClient`, no network, run from a temp dir): `POST /api/auth/token?user_id=…` → 200 + token; `POST /api/auth/login` with arbitrary phone/PIN → 200 + token; `POST /api/users/balance` (no auth) set the shared `default` balance to 999999 and `GET` returned it; same POST for an unknown `user_id` → 500 (`KeyError`).
  - `requests` error-text check with a fake key against an unresolvable host → the message contained the full URL including `?key=…`.
- **Problems:** shell working directory reset between calls (absolute paths used). Backend legacy auth was **read, not executed** (it would run `CREATE TABLE` on import against whatever `DATABASE_URL` is set).
- **Outstanding:** whole roadmap (T-001…T-030). Baseline gap discovered later (see 2026-10-31).
- **Next action:** owner decides on Phase 0 containment.

## 2026-10-30 — `CLAUDE.md` created
- **Objective:** a permanent operating manual for Claude Code tied to the real architecture.
- **Work completed:** wrote `CLAUDE.md` (architecture live/dormant table, verified commands, rules for understanding, preservation, quality, git, communication, task discipline, money, security, testing, docs; known-hazards list).
- **Files modified:** `CLAUDE.md` (new).
- **Decisions:** no AI co-author/attribution in commits; no unrequested commit/push.
- **Tests executed:** none (docs only); cited paths checked to exist.
- **Outstanding:** none. **Next action:** keep in sync via the protocol in `CLAUDE.md`.

## 2026-10-31 — Continuity docs and upstream baseline check
- **Objective:** create the project knowledge/continuity system (status, log, decisions, todo, changelog) without duplicating existing docs.
- **Work completed:**
  - Inspected all existing docs (README, `docs/*`, `apps/*/…md`, mobile `ARCHITECTURE_NOTES.md`, parent-folder files) and the git history. No status/log/changelog/ADR/TODO files existed in the repo.
  - Discovered that **`origin/main` is 3 commits ahead of the local clone** (`3696121`, 2026-09-12: secure PIN keypad, on-device voice biometrics, dual-SIM/Linka/deep-USSD, NLP auth tightening). Fetched them into a throwaway bare repo (the user's repo untouched) and diffed. Findings unchanged upstream (files identical): `auth.service.js`, `gemini_rest_service.py`, `UssdAccessibilityService.java`, `AndroidManifest.xml`, accessibility config, `execute-sync.controller.ts`, `session-parser.ts`, `action_executor.py`, `render.yaml`, CI workflow, `api.ts`. Partly fixed upstream: NLP `/api/cancel`, `/api/users/contacts`, `/api/pending-transactions` now require a JWT. `Log.i` of USSD codes still present in the native plugin.
  - Verified the GitHub repo is **public** (unauthenticated `git ls-remote` succeeded).
  - Corrected an earlier statement: the audit said local `main` was "in sync with origin"; that compared against a stale remote-tracking ref.
- **Files modified:** created `PROJECT_STATUS.md`, `TODO.md`, `DECISIONS.md`, `SESSION_LOG.md`, `CHANGELOG.md`; updated `CLAUDE.md` (documentation/session protocol, hazards now point to `TODO.md`, remote-freshness check, product-intent PIN wording). Outside the repo: the agent's memory note for this audit was corrected (baseline caveat). Verified afterward: only these six root files are new, the only modified tracked file is the pre-existing `.vscode/settings.json`, and every `T-nnn`/`ADR-nnnn` reference resolves.
- **Decisions:** files live at the repo root; status for features is tracked only in `PROJECT_STATUS.md` (CAHIER §7 treated as self-reported); retroactive ADRs marked as such; 3 ADRs left `proposed` for the owner.
- **Tests executed:** none (docs only). Git probes: `git ls-remote` (read-only), scratch-repo fetch and diffs.
- **Problems:** changelog/ADR dates come from commit subjects, some of which are vague ("we modify something") and were skipped, not guessed.
- **Outstanding:** upstream commits not reviewed in depth (T-011); everything in `TODO.md`.
- **Recommended next action:** owner runs `git fetch`, then re-validate T-003/T-007/T-017 against `3696121`; decide Phase 0.

## 2026-10-31 — Financial and transaction logic audit (read-only)
- **Objective:** audit all monetary/transaction logic for security, consistency, traceability and duplicate/inconsistent processing.
- **Work completed:** established scope — no payment provider, webhooks, subscriptions, refunds, invoices, taxes, commissions, discounts, payouts or reconciliation exist (keyword search + route inventory); money moves only through on-device MTN USSD. Reviewed the four financial surfaces on the local clone `03f977fe`: legacy ledger/balance mirror, v1 pipeline (dormant), NLP confirm cache, mobile transaction engine/SMS confirmation. Reviewed upstream `3696121` finance-related diffs (`MtnUssdCodes.ts`, `InterNetworkTransferEngine`, SMS confirmation) at diff level in the scratch repo. Result: findings recorded as T-031…T-042 (T-041 extends T-013); T-003 amended.
- **Corrections to earlier statements:** (1) in the local clone the transfer voice-PIN path (`confirmWithPin`) is unreachable — transfers type the PIN in MTN's dialog (T-003 text fixed); (2) the earlier "read-back uses the resolved contact's name" held only for that unreachable PIN prompt — live transfers never read back the resolved recipient (T-035); (3) `CLAUDE.md` §7 overstated the double-submit guard (per-instance; T-031).
- **Files modified:** `TODO.md`, `PROJECT_STATUS.md`, `CLAUDE.md` (one line, §7), `SESSION_LOG.md`; agent memory note. No application code, no financial records; no payment/provider API was called and no transaction was executed.
- **Decisions:** none (no ADR). Fixes not started.
- **Tests executed:** (a) real `SmsListenerService.extractBalanceWithPriority` via `tsx` on 6 strings: `12.500`→12500, `12 500`→12500, `12500.00`→1250000, `12 500,00`→1250000, `1500,50`→150050; (b) the engine's live-USSD expression `parseFloat(m.replace(/[,\s]/g,''))`: `12.500`→12.5, `12,500`→12500; (c) `isLikelyMtnMomoMessage("+22997000000", "…MTN MoMo…")` → `true`; (d) NLP `extract_amount_and_phone` on 16 phrases (e.g. "5,5 francs"→55; "cinq mille"→none, left to Gemini). Existing suites not re-run (no source changed).
- **Problems:** real MTN SMS/USSD message formats are unavailable, so the parsing findings are conditional on those formats; nothing verified on a device; upstream reviewed at diff level only.
- **Outstanding:** T-031…T-042 and everything earlier.
- **Recommended next action:** capture real MTN messages (SMS and USSD; success, failure, insufficient funds, timeout) from a test SIM to ground T-033/T-036/T-007; then fix T-031 + T-033 together, behind the T-010 test gate.

## 2026-10-31 — Database architecture and data-integrity audit (static, read-only)
- **Objective:** audit schema, constraints, indexes, migrations, access, query patterns, transactions, validation, isolation, sensitive data, backups.
- **Work completed:** inventoried every SQL statement in `apps/backend/legacy` and `src`, the three schema definitions (`db.js initDb()`, `legacy/config/schema.sql`, Prisma + its single migration), deletion patterns, transaction boundaries, policies and backup configuration. Findings recorded as T-043…T-051; T-006 extended with the schema-drift specifics.
- **Live database NOT inspected:** a Postgres listens on `localhost:5432` (container `autogest-postgres-1`, probably another project's). My read-only connection attempt using the credentials from `apps/backend/.env` was denied by the permission layer and I did not work around it. Consequently the findings are static; production schema, row counts, existing duplicates and backup state are **[Unknown]**.
- **Files modified:** `TODO.md`, `PROJECT_STATUS.md`, `SESSION_LOG.md`; agent memory note. No application code, no database touched. A read-only inspection script (`SELECT`/`SHOW` only, aggregates and catalog metadata, no row contents) was written to the session scratchpad for the owner: `/tmp/claude-1000/-home-satignon-Tek2-VoiceMomo/11305ba9-1ce4-4d73-b0be-7474512e4249/scratchpad/db_readonly_inspect.sql` (temporary; not in the repo).
- **Decisions:** none (no ADR; ADR-0014 remains proposed).
- **Tests executed:** greps for `DELETE|TRUNCATE|DROP|BEGIN|COMMIT|FOR UPDATE|POLICY|backup|statement_timeout` → no application hits; in-process probe of the NLP service (TestClient, no network): two users syncing contacts → `users_db["user-A"] is users_db["user-B"]` and both `is users_db["default"]` (True), user B's contacts overwrote user A's. Existing suites not re-run (no source changed).
- **Problems:** no live catalog; Prisma `P3005` behavior is inferred, not executed.
- **Outstanding:** T-043…T-051; owner to run the inspection script against each real environment.
- **Recommended next action:** owner runs the script (dev and production, read-only role), shares the output; then decide ADR-0014 and take a verified backup before any schema work.

## 2026-10-31 — Technical debt audit (read-only)
- **Objective:** produce a technical-debt register (duplication, size, coupling, cycles, dead code, unused dependencies, error handling, separation of concerns, naming, fragility, validation, testability, performance, legacy risk) without refactoring.
- **Work completed:** measured rather than estimated — function size and branch-count complexity with the TypeScript compiler API (102 mobile/backend JS/TS files) and Python `ast` (13 NLP modules); import graphs for cycles and orphans; dependency usage by source search with manual review of false positives (tooling and native-side packages such as `@capacitor/android`, `cordova-plugin-sms-receive`, backend `@types/*`/`prisma`/`tsx` are NOT unused). Findings recorded as T-052…T-067; T-024 now points to T-058 for dead-code removal.
- **Results worth remembering:** no circular imports in any area; the backend's production dependencies are all used; the largest unit is `useVoiceAssistantNLP` (566 lines, complexity 112); about 6,000 mobile lines are dead or unconsumed (5,110 are the unused shadcn `components/ui`); ~2,700 of ~4,100 backend lines have no mobile caller; a slow synchronous Gemini call blocks the NLP event loop (**[Ran]**: `/health` sent at 0.2 s completed at 2.01 s).
- **Deliberately NOT classified as debt:** the three-step USSD launch fallback (device variance), the deterministic amount override of Gemini output in `entity_normalizer.py` (a money-safety guard), the `legacy/` + `src/` split itself (ADR-0007; the open question is the dormant half, ADR-0013), flat dispatch tables (`buildInitialUssdCode`, `SIMPLE_USSD_INTENTS`), the rule-based `fallback.py` parser (inherent complexity; its debt is missing tests), and the "UX Fix #n" branching in the voice hook (deliberate product behavior).
- **Files modified:** `TODO.md`, `SESSION_LOG.md`; agent memory note. No source code, no dependencies, nothing committed. Analysis scripts live in the session scratchpad (not in the repo).
- **Tests executed:** none of the project's suites (no source changed). In-process probe for the event-loop finding (fake slow service, no network); the first run of that probe measured from the wrong clock and was redone before the result was recorded.
- **Problems:** complexity is a branch count, not a full cyclomatic metric; import resolution covers relative imports only (the dynamic `require(path.join(...))` of `registerRoutes.js` was treated as an entry point).
- **Outstanding:** T-052…T-067; nothing started.
- **Recommended next action:** the cheapest safe wins are T-061 (NLP client with timeout), T-059 (Python dependency hygiene) and step 1 of T-058 (unused packages), each small and behind `npm run build`/pytest. T-052 must wait for a confirm-idempotency guard (T-031/T-034).

## 2026-10-31 — First implementation: T-001 part 1 (OTP bypass and devCode off by default)
- **Objective:** close the critical legacy OTP takeover (T-001) with a minimal, tested change. Owner approved ("oui vas-y pour A, pas de branche"): work in the working tree, no branch, no commit.
- **Work completed:** tests written first and run against the unmodified code (5 failed, 6 passed — the 5 failures are the vulnerability checks), then the fix: `000000` and `devCode` only when `ALLOW_DEV_OTP=true`; SMS failure returns 503 instead of a fake success; the OTP code is no longer logged. Residual found by the tests: OTP-created accounts keep PIN `0000` and `login()` accepts it → T-068 (not changed: PIN behaviour needs approval).
- **Files modified:** `apps/backend/legacy/services/auth.service.js` (+helper `_devOtpAllowed`, 3 call-site changes), `apps/backend/.env.example` (documents `ALLOW_DEV_OTP` and the SMS provider variables), `apps/backend/tests/unit/legacy-auth-otp.test.ts` (new, 11 tests); docs: `TODO.md` (T-001 status, T-068), `DECISIONS.md` (ADR-0015; ADR-0009 index row), `CHANGELOG.md`, `PROJECT_STATUS.md`, `CLAUDE.md` (test counts, hazards wording). `apps/backend/.env` (local, untracked) was not touched. The mobile app needed no change (`LoginScreen` already tolerates a missing `devCode` and shows the send error).
- **Decisions:** ADR-0015.
- **Tests executed:** `npx --no-install jest --ci tests/unit/legacy-auth-otp.test.ts` → before fix 5 failed / 6 passed; after fix 11/11 passed. Full backend suite → 6 suites, 23 tests passed. `node --check legacy/services/auth.service.js` → OK. `npx --no-install tsc --noEmit -p .` → no diagnostics.
- **Problems:** `legacy/` is not covered by `tsc`, hence the explicit `node --check`; the SQL branch of `verifyOtp` needs a database to test; with the flag off and no SMS provider configured, login now fails by design (503).
- **Outstanding:** nothing is committed or deployed. Before deploying: configure Twilio/Termii on Render (or set `ALLOW_DEV_OTP=true` knowingly). Local development without a provider needs `ALLOW_DEV_OTP=true` in the developer's own `.env`. T-068 (PIN `0000`) and T-005 (attempt limits) remain.
- **Recommended next action:** decide T-068 (option a recommended: refuse PIN-login while the account is still on the default PIN), then T-002.

## 2026-10-31 — T-068: the default PIN `0000` no longer opens a PIN session (option a)
- **Objective:** close the second takeover path found by the T-001 tests: `POST /api/auth/login` accepting `0000` on OTP-created accounts. Owner chose option (a) ("option a pour T-068"); working tree, no branch, no commit.
- **Work completed:** tests first — the pinned "known gap" test was replaced by 4 tests; on the unfixed code 2 failed (the closure checks) and 2 passed (PIN change from `0000`, personal PIN login — the no-regression checks). Then the fix: `DEFAULT_OTP_PIN` constant, and `login()` rejects it with the same 401 "PIN incorrect." as a wrong PIN, before any account lookup; `verifyOtp` now uses the constant.
- **Files modified:** `apps/backend/legacy/services/auth.service.js`, `apps/backend/tests/unit/legacy-auth-otp.test.ts`; docs: `TODO.md` (T-068, T-001 status), `DECISIONS.md` (ADR-0016), `CHANGELOG.md`, `PROJECT_STATUS.md`, `CLAUDE.md` (test counts, hazards wording).
- **Decisions:** ADR-0016 — uniform 401 rather than an explanatory error (an explanatory error would reveal which accounts are still on the default PIN).
- **Tests executed:** `npx --no-install jest --ci tests/unit/legacy-auth-otp.test.ts` → 14/14; full backend suite → 6 suites, 26 tests passed; `node --check legacy/services/auth.service.js` OK; `npx --no-install tsc --noEmit -p .` no diagnostics; grep shows no remaining bare `"0000"` literal in `legacy/`.
- **Problems:** the PIN screen was exercised only through the service (`updatePin`), not on a device; a user who deliberately chose `0000` can no longer PIN-login (OTP unaffected).
- **Outstanding:** nothing is committed or deployed; production stays exposed until deployed (SMS provider must be configured first, see the T-001 entry). T-005 (attempt limits) and T-002 remain.
- **Recommended next action:** T-002 (NLP endpoints that issue tokens without credentials), or deploy the T-001/T-068 working tree after configuring the SMS provider — owner's call.

## 2026-10-31 — T-002: NLP service no longer issues tokens without credentials
- **Objective:** close the second critical finding (T-002). Owner said "continue" after the T-002 recommendation; working tree, no branch, no commit.
- **Work completed:** tests first (`apps/nlp/tests/test_auth_hardening.py`, 27 tests; 20 failed and 7 passed on the unmodified code — the 7 are the no-regression checks: `/api/confirm` and `/api/voice-command` already required a JWT, dev mode with the flag, valid token). Then: `app/auth.py` — no default `JWT_SECRET` (import raises) and a `require_test_endpoints` dependency; `app/main.py` — that dependency on the 7 test endpoints (404 unless `ENABLE_TEST_ENDPOINTS=true`), and `cancel` / `contacts` / `pending-transactions` now require a JWT, written to be identical to the fix already on `origin/main` `3696121`.
- **Files modified:** `apps/nlp/app/auth.py`, `apps/nlp/app/main.py`, `apps/nlp/.env.example` (replaced the two never-read flags with `ENABLE_TEST_ENDPOINTS`, `JWT_SECRET` now blank and mandatory), `apps/nlp/tests/conftest.py` (hermetic defaults: test `JWT_SECRET`, dummy `GEMINI_API_KEY`), `apps/nlp/tests/test_integration.py` (`test_generate_token` now asserts closed-by-default and open with the flag), `apps/nlp/tests/test_auth_hardening.py` (new); docs: `TODO.md` (T-002, T-020, T-026), `DECISIONS.md` (ADR-0017), `CHANGELOG.md`, `PROJECT_STATUS.md`, `CLAUDE.md` (NLP command, test note, hazards). `apps/nlp/.env` (local, untracked) was not touched.
- **Decisions:** ADR-0017 (gate rather than delete the mock endpoints; byte-identical `cancel`/`contacts`/`pending` fix).
- **Tests executed:** new tests 27/27; full NLP suite 47 passed with the documented dummy keys and again with NO env vars (conftest makes it hermetic); a startup attempt without `JWT_SECRET` raises `RuntimeError: JWT_SECRET n'est pas défini …`; the 2026-10-30 audit probe replayed → token endpoints 404, `pending-transactions` without a token 401, shared balance no longer writable; `git apply --3way` of the NLP changes onto `origin/main` `3696121` in a scratch worktree applied all 5 files cleanly and the suite passed there too (47).
- **Problems:** the first version of the patch script's whitespace-sensitive pattern did not match and aborted without writing anything (by design), then was made tolerant and re-run; `JWT_SECRET` in the local `.env` is read because `app.config` calls `load_dotenv()` before `app.auth` is imported — an import-order dependency worth keeping in mind.
- **Outstanding:** nothing is committed or deployed. Before deploying: the NLP service on Render must have `JWT_SECRET` set (the blueprint links it to the backend's), otherwise it will not start; a local `apps/nlp/.env` needs `JWT_SECRET` equal to the backend's. `/ai/parse` is still unauthenticated (T-016); users still share state in the in-memory store (T-050); `docs/nlp/README_PRODUCTION.md` curl examples need the flag (T-026).
- **Recommended next action:** with T-001, T-068 and T-002 done, review the diff and commit/deploy them (after configuring the SMS provider and checking `JWT_SECRET` on Render), then `git fetch`; or continue with T-004 (Gemini TLS and key in the URL).

## 2026-10-31 — T-004 part 1: Gemini voice path verifies TLS and no longer exposes the key
- **Objective:** fix the Gemini transport findings on the path the app actually uses. Owner said "continue"; working tree, no branch, no commit.
- **Work completed:** tests first (`apps/nlp/tests/test_gemini_transport.py`, 7 tests; all 7 failed on the unmodified code, and the captured logs showed `…generateContent?key=<key>` in a WARNING). Then `gemini_rest_service.py`: removed the module-level `session.verify = False`, the per-request `verify=False` and `urllib3.disable_warnings()`; the key moved to the `x-goog-api-key` header; added `_scrub()` for log text; failures now return fixed messages (no `str(e)`); the parse-failure `raw_output` no longer carries the exception text. `main.py`: the 500 handler of `/api/voice-command` returns a fixed message (details stay in server logs).
- **Deferred on purpose:** `gemini_client.py` (`/ai/parse`) — key still in the URL at line 100. Upstream `3696121` rewrote the lines that call it (retry loop), so editing now would create a merge conflict; `service.parse` swallows its exceptions, so nothing leaks to logs or responses meanwhile. To do after the owner merges upstream.
- **Files modified:** `apps/nlp/app/gemini_rest_service.py`, `apps/nlp/app/main.py` (one hunk), `apps/nlp/tests/test_gemini_transport.py` (new); docs: `TODO.md` (T-004), `DECISIONS.md` (ADR-0018), `CHANGELOG.md`, `PROJECT_STATUS.md`, `CLAUDE.md`.
- **Decisions:** ADR-0018 — no insecure opt-out for TLS (the existing but unused `settings.disable_ssl_verify` stays unused); TLS-inspecting proxies use the standard `REQUESTS_CA_BUNDLE`.
- **Tests executed:** new tests 7/7; full NLP suite 54 passed with no environment variables (the 3 urllib3 InsecureRequest warnings seen before are gone); local HTTPS server with a self-signed certificate: the production session refuses it (`SSLError`) and accepts it once `REQUESTS_CA_BUNDLE` points to its CA; `git apply --3way` of all NLP changes onto `origin/main` `3696121` applied 6 files cleanly and the suite passed there too (54).
- **Problems:** the real Gemini endpoint was not called (by design — no external requests), so end-to-end behaviour with real certificates is verified only through the local TLS check; developers behind a TLS-inspecting network must now configure a CA bundle instead of relying on disabled verification.
- **Outstanding:** nothing is committed or deployed. Owner actions: check Render's NLP logs for the key in past Gemini error lines and rotate the key after deploying; part 2 after merging upstream. The transcript logging at `gemini_rest_service.py:209` (T-003) and the blocking calls (T-052) are unchanged.
- **Recommended next action:** review and commit T-001/T-068/T-002/T-004 part 1, deploy (SMS provider, `JWT_SECRET`, rotate the Gemini key), then `git fetch` + merge and do T-004 part 2 and T-011.

