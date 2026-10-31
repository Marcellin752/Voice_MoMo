# PROJECT_STATUS — Voice MoMo

**CURRENT STATE only.** History → `SESSION_LOG.md` / `CHANGELOG.md`. Work items → `TODO.md`. Rationale → `DECISIONS.md`.
Architecture → `CLAUDE.md` §Architecture (not repeated here). Scope/spec → `docs/CAHIER_DES_CHARGES.md`.

**Last updated:** 2026-10-31
**Baseline:** the audit and every finding below were established on the clone at `03f977fe` (2026-09-03). On 2026-10-31 `origin/main` (`3696121`, 3 commits of 2026-09-12) was merged into `main` (merge commit `7020529a`, pushed the same day) together with the security fixes of this series. The merged upstream code (secure PIN keypad, voice biometrics, deep USSD codes, dual-SIM, Linka fees/SMS) was **reviewed at diff level only**; findings marked *upstream* describe it, and re-validation of the PIN, success-reporting and storage findings against the merged tree is still open (T-011).
**Evidence labels:** **[Ran]** executed · **[Read]** read in source · **[Claimed]** stated in a doc/commit, not verified · **[Unknown]**.

## Purpose and problem
Voice-only mobile money for people outside the digital world (illiterate, elderly, visually impaired) in Bénin, on MTN MoMo, in French: someone who cannot read or type should be able to finish a money operation unaided. The real value is that use case, not the app (CAHIER §1–2; `README.md`).

## Maturity
Pre-release MVP; **not production-ready**.
- README badge "MVP In Progress"; debug-signed APKs are published as CI prereleases (`build-N` tags, 70 locally, last `build-104` on 2026-09-03). No release signing **[Read]**.
- Two critical auth weaknesses (T-001, T-002) and no automated tests on the live paths (T-010).
- The repo is **public** (unauthenticated `git ls-remote` succeeded, 2026-10-31 **[Ran]**), so source-level weaknesses are publicly readable.
- Real-user count, which backend/DB is live (`render.yaml` Postgres vs. `db.js` comments naming Neon), and whether investors saw the "production ready" documents: **[Unknown]**.

## Modules
| Module | State | Evidence |
|---|---|---|
| Mobile voice flow (record → NLP → intent → read-back) | Implemented | [Read]; no tests |
| MTN→MTN transfer via on-device USSD | Implemented | [Read]; device behavior **not verified** |
| Inter-network transfer (Linka) | Implemented; sender must be MTN | [Read] |
| Balance: SMS first, USSD+PIN fallback | Implemented | [Read] |
| Recharge / withdraw / bill / forfaits | **Menu-open only** (user must read the screen) | [Read]; ADR-0010 |
| Contact resolution + voice disambiguation | Implemented | [Read] |
| OTP login (the app's only login path) | Implemented, **insecure** | [Read]; T-001 |
| Backend `legacy/` API (auth, users, ledger mirror) | Live | [Read] |
| Backend `src/` v1 (BullMQ, Prisma, modem, Socket.IO) | **Dormant**, mock modem on Render, no app caller | [Read]; ADR-0013 |
| `/api/mmi/*` | Simulated responses, not used by app | [Read]; T-014 |
| NLP service (Gemini STT+NLU) | Live | [Read]; 54 tests pass |
| Push notifications | Stub | [Read] |
| *upstream*: secure PIN keypad, on-device voice biometrics, dual-SIM MTN selection, Linka fees/SMS | Merged into `main` on 2026-10-31; builds and existing tests pass, **behaviour not reviewed or tested on a device** | [Claimed] by commit messages; T-011 |

## Verified functional (executed on the local clone, 2026-10-30)
- Backend: `tsc --noEmit` printed no diagnostics; Jest 5 suites / 12 tests pass (`src/` only) **[Ran]**.
- NLP: `tests/test_integration.py` 20 pass with dummy keys **[Ran]**.
- 2026-10-31, after the T-001 and T-068 changes: backend Jest 6 suites / 26 tests pass, including 14 new legacy OTP/PIN-login tests (7 of them failed on the code before each fix, as designed); `node --check` on `auth.service.js` and `tsc --noEmit` clean **[Ran]**. The SQL path of `verifyOtp` is not covered (no database in unit tests).
- 2026-10-31, after the T-002 changes: NLP pytest 47 passed (27 new auth-hardening tests; 20 of them failed on the previous code, as designed), with no environment variables set; also 47 passed on the result of applying the changes onto `origin/main` `3696121` in a scratch worktree (clean 3-way apply, no conflicts). The audit's token-minting probe now returns 404/401 **[Ran]**.
- 2026-10-31, after the T-004 part 1 changes: NLP pytest 54 passed with no environment variables, also on the result of applying all NLP changes onto `origin/main` `3696121` (clean). A local self-signed HTTPS server confirmed the Gemini session now refuses unknown certificates and accepts them with `REQUESTS_CA_BUNDLE`. The real Gemini endpoint was not called **[Ran]**.
- 2026-10-31, after the T-019 change: mobile `npm test` 7 passed (the first mobile tests; 2 failed on the unfixed code); a real `vite build` to a temporary directory succeeded and still injects the backend URL; strict `tsc` on `api.ts` is clean **[Ran]**. The mobile screens themselves, spoken delivery of these messages and anything on a device were not exercised.
- 2026-10-31, T-004 part 2 + T-061 + UX (working tree, **not pushed**): NLP pytest **57 passed**; mobile **14 passed** (Node 22.23.2); backend 26; Vite build to a temp dir succeeded **[Ran]**. Device and Render still not exercised.
- Negative verification: NLP mints a token with no credentials, accepts any login, and an unauthenticated POST overwrote the shared "default" balance **[Ran]**.
- **Nothing is verified end-to-end on a device or against the deployed hosts.** No USSD, transfer, balance, SMS or accessibility behavior has been tested in this record.

## Under development
- Last product commits: upstream 2026-09-12 (3 commits). 2026-10-31: 32 fix/test commits plus a merge of `origin/main`, pushed to `origin/main` (merge `7020529a`, plus the CI fix `daaa2cb5`, T-070); the documentation commits that follow are local only (owner's choice: the repository is public) — see `SESSION_LOG.md`. Other current activity: **[Unknown]**.
- Unmerged work on `origin/mobile` (9 commits), `origin/execute_mmi` (1), `origin/features/v1` (1).
- T-001, T-068, T-002, T-004 (part 1) and T-019 are implemented and **pushed to `origin/main` (2026-10-31, `7020529a`); deployment not verified** (owner approved on 2026-10-31; no branch). The owner states the SMS provider and the NLP `JWT_SECRET` are configured on Render **[Claimed]**; CI "Build Android APK" **failed** on that push in its "Set up Android SDK" step (`sdkmanager`: "Failed to find package 'tools'") before any project code was built — the workflow file is not changed by this series and the last green build was 2026-09-11 (`3696121`), so no APK was published for that push; fixed by `daaa2cb5` (T-070): the next run was green and published prerelease `build-111` — not installed or tested on a device; Render's auto-deploy is **[Unknown]**. No other `TODO.md` item has been started; the roadmap is otherwise approved item by item.

## Known limitations
French only; Android only; MTN-Bénin senders only (`utils/authUser.ts`); internet required (NLP cloud); `minSdk 24` but silent USSD needs API 26; Gemini quota/latency; no velocity limits (docs mention 3/min, 500k/day, 1M/month — not implemented, T-028). Spec-level limits: CAHIER §11.

## Critical technical risks
1. **T-001 / T-068** The OTP `000000` bypass, the OTP-in-response and the default-PIN login (`0000`) are fixed in `origin/main` (pushed 2026-10-31, **deployment not verified**; ADR-0015, ADR-0016). Production stays exposed until the new code is deployed, and the code is public. Remaining auth hardening: attempt limits (T-005).
2. **T-002** Fixed in `origin/main` (pushed 2026-10-31, **deployment not verified**; ADR-0017): the NLP test endpoints are off by default and the service refuses to start without `JWT_SECRET`. Remaining NLP exposure: `/ai/parse` unauthenticated (T-016), shared in-memory user store (T-050).
3. **T-003** PIN handling: local clone uploaded dictated PIN audio; native code logs USSD strings incl. a live-balance PIN (still in upstream plugin).
4. **T-007** Failures can be reported as success (matters most for the target users).
5. **T-010** No test/CI gate on live paths, so none of the fixes can ship safely yet.
6. **T-031 / T-032 / T-033** Transfer outcome handling (financial audit 2026-10-31): a 45 s timeout tells the user to retry while the transfer may have gone through; no record of initiated transfers exists anywhere; "confirmation" is any MTN-looking SMS (spoofable, not tied to the transfer). Real money moves only on the handset via MTN, so there is no payment-provider/webhook/refund layer to audit.
7. **T-043 / T-044 / T-006** Database (audit 2026-10-31): the schema depends on bootstrap order (three sources); bearer JWTs and OTPs are stored in plaintext; no explicit index, `CHECK`, backup or restore procedure exists; in RAM-fallback mode a restarted process can reuse a user id that an old token still carries. The real databases were not inspected (live access was not available — see `SESSION_LOG.md`).

## Documentation reliability
`CAHIER_DES_CHARGES.md` §7–8 mark most items "✅ Complète"; treat as self-reported. Known conflicts: dictated PIN "✅" (never delivered to USSD locally; replaced by a keypad upstream); "HTTPS" "✅" (cleartext allowed in manifest); "détection d'anomalies" and "PIN/Biométrie" "✅" (no such code in the local clone); "Android 8+" (minSdk 24); `docs/nlp/IMPLEMENTATION_GUIDE_TRANSFER_DIRECT.md` velocity limits (not implemented). `README.md` lists Google Cloud STT/TTS (code uses Gemini REST + on-device TTS). Investor files in the parent folder (outside git) claim "PRODUCTION READY" / "bank-grade security" — contradicted by T-001/T-002 (T-012). Reconciliation: T-026.

## Priorities and immediate next actions
1. **Rotate the Gemini API key (B8)** and read old NLP logs — the only check with a live secret at stake. Then run the rest of `HANDOFF_TESTS.md` (T-071): Render (B1–B7) and `build-111` on a phone (C1–C10).
2. **Commit/push the local working tree** (T-004 part 2, T-061, ADR-0020/0021 UX) only after the owner agrees; it is not in `build-111`. Device check of that tree is T-072.
3. Next implementation items after that, one at a time: T-011 (re-validate T-003/T-007/T-017 from C5/C7/C8), T-005 (lockout policy — needs a decision), T-010 (CI test gate).
4. Open decisions: live users? do demos rely on `000000`/on-screen OTP? which branch releases? were investor docs shared (T-012)? keep/park/remove the dormant v1 stack (ADR-0013)? PIN entry approach (ADR-0012)? lockout policy (T-005)?
5. Put a CI test gate in place (T-010): CI currently only builds the APK.
