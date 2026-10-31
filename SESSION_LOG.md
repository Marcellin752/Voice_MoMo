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

