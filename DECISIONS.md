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

