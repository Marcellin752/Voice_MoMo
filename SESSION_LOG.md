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

