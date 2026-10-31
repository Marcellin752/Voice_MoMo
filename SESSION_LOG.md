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

