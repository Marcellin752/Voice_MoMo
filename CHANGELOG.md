# Changelog — Voice MoMo

User-oriented, newest first. Categories: **Added · Changed · Fixed · Removed · Security**. Internal refactors are not listed.

**Provenance:** reconstructed on 2026-10-31 from git commit subjects (the repo has no earlier changelog). Dates are commit dates. Entries describe what the commits say; they were **not re-verified on a device**. There are no semantic versions: CI publishes a debug-APK prerelease per push to `main` (tags `build-N`, last known `build-104` on 2026-09-03). New entries go under **Unreleased**.

## [Unreleased]
### Security — on local `main`, not yet pushed or deployed
- The test OTP code `000000` and the on-screen OTP (`devCode`) are disabled unless `ALLOW_DEV_OTP=true` is set. If the SMS cannot be sent, the app now receives an error instead of the code, and OTP codes are no longer written to the server logs. **Deployment note:** an SMS provider must be configured, otherwise login fails (503).
- The default PIN `0000` given to accounts created with an SMS code can no longer be used to sign in through `POST /api/auth/login`; changing the PIN from the settings still works.
- The voice (NLP) service no longer hands out login tokens to anyone: its test endpoints (token, login, register, mock profile/balance/transactions) are off unless `ENABLE_TEST_ENDPOINTS=true`, cancelling, syncing contacts and listing pending transactions now require a valid login token, and the service refuses to start without `JWT_SECRET` instead of using a publicly known default. **Deployment note:** the NLP service needs the same `JWT_SECRET` as the backend.
- Voice analysis calls to Gemini now verify the server's TLS certificate and send the API key in a request header instead of the URL; the key is removed from logs, and error responses no longer contain internal exception text. Behind a proxy that inspects TLS, set `REQUESTS_CA_BUNDLE` to its CA bundle.

### From `origin/main` (`3696121`, 2026-09-12), merged on 2026-10-31 — per commit messages, unreviewed
- **Added:** secure PIN keypad ("PIN is never spoken or sent to NLP"); on-device voice biometrics that gate sensitive operations (2 attempts, then logout) with anti-replay checks and an audit journal; amount-aware MoMo USSD codes; stronger dual-SIM MTN selection; Linka fee announcement and dedicated Linka SMS parsing.
- **Fixed:** double biometric prompts and TTS/microphone overlap; contact voice matching restored; Gemini retries.
- **Security:** NLP `/api/cancel`, `/api/users/contacts` and `/api/pending-transactions` now require a valid JWT.

### Fixed — on local `main`, not yet pushed or shipped
- The login, PIN and profile screens now show the server's real error message (wrong PIN or SMS code, too many attempts, "the SMS could not be sent") instead of a generic "Erreur réseau".

## 2026-09
- **Fixed:** login hang with no feedback after requesting an OTP; contact picker closing by itself; overlapping spoken messages (09-03). Backend errors now keep their real status code (09-03). NLP rate-limit crash (09-03). Voice analysis retries when Gemini is overloaded (09-02).
- **Security:** strict JWT authentication on the NLP voice endpoints (09-02).

## 2026-06
- **Added:** transfers between networks, MTN → Moov/Celtis via Linka (06-16). Automatic logout after 5 minutes of inactivity (06-21). Voice-only confirmation, PIN entry and contact disambiguation (06-21). Recharge, withdrawal and bill payment by voice — these open the MTN menu, they do not complete the operation (06-21).
- **Changed:** recipients are resolved from the phone's contacts on the device (06-17). Sender phone number normalized at login (06-21). Repository restructured into `apps/` (06-18).
- **Fixed:** accidental cancel while picking a contact (06-14); missing recipient number in the transfer code (06-14); MTN prefix detection (06-21); app screens now require login (06-21).
- **Removed:** manual transaction screens and manual balance refresh (06-21).

## 2026-05
- **Added:** GAB withdrawal, internet/Go Pack forfaits and bill-payment actions (05-07). Contacts synced to the voice service (05-11). Balance read from MTN SMS (05-11). Silent USSD handling on Android via the accessibility service (05-11) and in the background (05-13). Live balance refresh (05-17). Login by SMS code via Twilio/Termii (05-17). Contact disambiguation dialog (05-18); push-to-talk (05-18); homonym handling and SMS-based transaction confirmation (05-18). Deposit intent (05-06).
- **Changed:** MTN Bénin USSD formats corrected — recipient number repeated, `01` prefix enforced (05-20). Welcome screen removed; app opens on login (05-17).
- **Security:** a development-only OTP bypass code (`000000`) was added (05-18) and an on-screen OTP when SMS fails (05-17). Both are still active — see `TODO.md` T-001.

## 2026-03
- **Added:** project start (03-16; Flutter attempt replaced on 03-18). Backend API: accounts, users, transactions, voice (03-18…24). Contacts page (03-20). Gemini voice module (03-24). Android APK build via Capacitor and GitHub Actions, published as GitHub releases (03-24/25). Render deployment config (03-24). Register screen with first/last name (03-25).
