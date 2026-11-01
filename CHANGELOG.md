# Changelog — Voice MoMo

User-oriented, newest first. Categories: **Added · Changed · Fixed · Removed · Security**. Internal refactors are not listed.

**Provenance:** reconstructed on 2026-10-31 from git commit subjects (the repo has no earlier changelog). Dates are commit dates. Entries describe what the commits say; they were **not re-verified on a device**. There are no semantic versions: CI publishes a debug-APK prerelease per push to `main` (tags `build-N`, last known `build-104` on 2026-09-03). New entries go under **Unreleased**.

## [Unreleased]
### Fixed — 2026-11-01, voice dialogue (owner's phone test, not re-tested on a device yet)
- When several contacts match the name, the app now asks *which one* before asking "oui/non", and the confirmation question repeats the exact person (first name + last four digits spoken, full name on screen), the amount, the network and any Linka fees: "Vous voulez déposer 200 francs sur le compte de David, numéro 1 2 3 4. Est-ce bien cela ? Dites oui pour confirmer, ou non pour annuler." The chosen contact's number is the one used for the USSD step (ADR-0023).
- "Erreur confirmation" no longer stops the operation: the voice server's simulated confirmation step is bookkeeping only; if it fails the phone proceeds to the USSD step with what it understood (ADR-0023).
- The contact-choice window closed by itself after about two seconds: it was tied to the assistant's status, which the automatic microphone restart changed. It now stays open until a contact is chosen (tap or voice) or the user cancels, and the voice prompt finishes before the microphone opens.
- "Oui" after a confirmation request, and "1/2/3" or a name during a contact choice, were handled as brand-new commands because the microphone restart had already replaced the waiting status. The app now remembers the dialogue phase separately, so the answer goes where it belongs and the USSD step is reached.
- Tapping the microphone while the app waits for "oui" or for a contact choice now opens the microphone to answer instead of cancelling; the microphone button stays reachable above the contact window to end the recording. Cancelling is done by voice ("non", "annule").
- The app no longer announces "Opération réussie" when there was nothing to execute (e.g. a stray "oui").
- The app can be interrupted while it speaks: tapping the microphone (or a contact in the list) stops the voice at once and the dialogue follows the user's action — the mic opens for "oui/non" or the choice, instead of finishing the sentence and leaving the app in a listening state that no longer matches. The microphone now re-opens 0,7 s (was 1,8 s) after a spoken question.
- The homonym prompt no longer lists every contact with its digits; it says how many were found and asks to choose in the list by touch or by position ("un, deux, trois").
- Screen frozen after "oui": once the app's voice had been interrupted, the native text-to-speech never reported the end of the cut sentence, so every later sentence waited forever and no dialogue step could open. Speech is now bounded by the interruption and by a time limit. Also: an empty recording no longer leaves the app in "traitement", a network error while answering "oui/non" or choosing a contact re-asks the question instead of dropping the operation, and "ouais", "yes", "c'est bon", "c'est ça", "bien sûr", "je confirme" count as a yes.

### Fixed — 2026-11-01, pushed as `3f6c6c20`, not on a device
- Error and success messages were never displayed anywhere in the app: the notification component (`sonner` `<Toaster />`) was never mounted, so every `toast.error(...)` (login, home, voice-only redirect) was silently dropped. On the login screen this looked like "it spins, then nothing". The toaster is now mounted at the app root, and the login screen additionally shows the error under the button until the next attempt.

### Security — 2026-11-01, demo switch (ADR-0022)
- New backend variable `SHOW_OTP_WHEN_SMS_FAILS=true`: when the SMS cannot be sent (or no provider is configured), the login code is returned to the app and shown on screen, **without** re-enabling the `000000` test code (unlike `ALLOW_DEV_OTP`). While set, anyone who knows a phone number can log in as it — supervised demos only; remove it once a provider delivers to Bénin.

### Changed — local working tree 2026-11-01, not pushed, not on a device
- Login screen: the "Renvoyer le code" button becomes available 60 s after a code was requested (it used to wait the full 5 minutes of code validity); the server still limits to 3 codes per 15 min.
- The app wakes the backend as soon as the login screen opens, and the voice service as soon as the main screen opens, so the first SMS-code request and the first voice command do not run into the free-tier cold start.
- Build: `scripts/build-apk.sh` prints the backend URL that will be baked into the APK and warns when it is a local/LAN address; `docs/BUILD_APK.md` documents how to build a stand-alone APK against the Render servers.

### Security — pushed to `origin/main` on 2026-10-31 (`86217bf9`), deployment not verified, not on a device
- The `/ai/parse` Gemini client no longer puts the API key in the URL (same header as the voice path). Connection errors no longer include the exception text.
- Voice operations no longer require recording enrollment phrases: the app learns the speaker from ordinary commands on the phone (first few commands are not blocked).

### Changed — pushed to `origin/main` on 2026-10-31 (`86217bf9`), not on a device
- When several contacts share a name, the list is tappable (voice “1, 2, 3” still works). Confirmation **shows** the full name and **speaks** the first name plus the last four digits, so the voice does not mangle the surname.
- If the voice service does not answer within two minutes, the app stops waiting and says so (instead of spinning forever).

### Security — pushed to `origin/main` on 2026-10-31 (`7020529a`), deployment not verified
- The test OTP code `000000` and the on-screen OTP (`devCode`) are disabled unless `ALLOW_DEV_OTP=true` is set. If the SMS cannot be sent, the app now receives an error instead of the code, and OTP codes are no longer written to the server logs. **Deployment note:** an SMS provider must be configured, otherwise login fails (503).
- The default PIN `0000` given to accounts created with an SMS code can no longer be used to sign in through `POST /api/auth/login`; changing the PIN from the settings still works.
- The voice (NLP) service no longer hands out login tokens to anyone: its test endpoints (token, login, register, mock profile/balance/transactions) are off unless `ENABLE_TEST_ENDPOINTS=true`, cancelling, syncing contacts and listing pending transactions now require a valid login token, and the service refuses to start without `JWT_SECRET` instead of using a publicly known default. **Deployment note:** the NLP service needs the same `JWT_SECRET` as the backend.
- Voice analysis calls to Gemini now verify the server's TLS certificate and send the API key in a request header instead of the URL; the key is removed from logs, and error responses no longer contain internal exception text. Behind a proxy that inspects TLS, set `REQUESTS_CA_BUNDLE` to its CA bundle.

### From `origin/main` (`3696121`, 2026-09-12), merged on 2026-10-31 — per commit messages, unreviewed
- **Added:** secure PIN keypad ("PIN is never spoken or sent to NLP"); on-device voice biometrics that gate sensitive operations (2 attempts, then logout) with anti-replay checks and an audit journal; amount-aware MoMo USSD codes; stronger dual-SIM MTN selection; Linka fee announcement and dedicated Linka SMS parsing.
- **Fixed:** double biometric prompts and TTS/microphone overlap; contact voice matching restored; Gemini retries.
- **Security:** NLP `/api/cancel`, `/api/users/contacts` and `/api/pending-transactions` now require a valid JWT.

### Fixed — pushed to `origin/main` on 2026-10-31; in the `build-111` prerelease APK (not tested on a device)
- The login, PIN and profile screens now show the server's real error message (wrong PIN or SMS code, too many attempts, "the SMS could not be sent") instead of a generic "Erreur réseau".
- The automatic APK build (GitHub Actions) failed at the Android SDK setup step on every push since the SDK repository dropped the `tools` package; the step now installs only `platform-tools` (`daaa2cb5`). The next build succeeded and published prerelease `build-111` (T-070).

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
