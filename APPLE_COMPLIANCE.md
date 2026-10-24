# App Store compliance

Raco must pass App Review. This file maps Apple's rules to how the app meets
them, and lists what still has to be done by hand before each submission.
`npm run apple-check` runs the automated part.

Last checked against the guidelines: 2026-10-24
Guidelines revision compared: App Review Guidelines, last updated 2026-10-16
(<https://developer.apple.com/app-store/review/guidelines/>)

**Before any release, and whenever a change touches a rule below:** open the
guidelines page, compare its "last updated" date with the one above, read
what changed (Apple posts a summary under Developer News), update this file
and the check script, then bump the dates.

## How the app meets each rule

| Guideline | Rule | How Raco meets it |
|---|---|---|
| 1.2 | AI content apps need filtering, reporting, timely responses and contact info | Model safety and the system prompt filter output. A long press on any reply offers **Report response** (`POST /v1/reports`, stored in `message_reports`). Settings has **Contact support**. There is no user-to-user content, so blocking users doesn't apply; say so in the review notes. |
| 1.2 (2026-10) | Prevent AI-generated nonconsensual intimate imagery | Raco only produces text. If image generation is ever added, it must block images of real people and sexual content before shipping. |
| 1.5 | Easy way to contact you | Settings → Help & legal → Contact support; support URL in App Store Connect. |
| 2.1 | Complete app, demo account, live backend | The production build has demo mode off (`eas.json`), and the API refuses `LLM_PROVIDER=demo` and `STORE=memory` when `NODE_ENV=production`. |
| 2.3.1 | Describe features accurately; no hidden features | The review notes must list every feature. Demo mode is not reachable in production builds. |
| 2.5.1 | Public APIs only, current SDK | Expo SDK 58 with public modules only. EAS builds use the `latest` image (Xcode 26 and the iOS 26 SDK, required for uploads since 2026-04-28). |
| 2.5.2 | No downloaded or executed code | No `eval` or remote code. OTA updates may only change JS and assets within the reviewed purpose. |
| 2.5.13 | Face ID through LocalAuthentication, with a fallback | `expo-local-authentication` with the device passcode fallback left on. |
| 2.5.14 | Consent and a visible indicator when recording | The microphone only runs while the talk button is held; the stage glows and shows the live transcript while listening. |
| 4.2 / 4.3 | More than a wrapper; not a clone | Voice-led onboarding, voice mode, a personal agent name, reply styles and Face ID lock. Describe them in the review notes. |
| 4.5.4 | Push isn't required and isn't used for marketing without opt-in | Notifications are optional and off unless chosen in onboarding or Settings. |
| 4.8 | Offer Sign in with Apple when offering Google | Apple, Google, email code and password are all offered. |
| 5.1.1(i) | Privacy policy in App Store Connect and in the app | Linked on the welcome screen, during onboarding and in Settings. |
| 5.1.1(ii) | Consent, a way to withdraw it, clear purpose strings | Purpose strings in `app.json`. AI data sharing can be switched off in Settings. |
| 5.1.1(v) | Account deletion in the app | Settings → Delete account (`DELETE /v1/account`, which cascades all data, including projects, tasks, pinned chats and Library items). |
| 5.1.2(i) | Name the third-party AI and get explicit permission before sharing data | Before onboarding answers or any chat message leave the phone, a **Before you start** sheet (Agree and continue / Not now) names the provider (`EXPO_PUBLIC_AI_PROVIDER`) and what is sent. The answer is saved as `profiles.ai_consent_at`. Without it the API refuses chat (`consent_required`) and voice onboarding uses the on-device reader. |
| 5.1.2(ii) | Don't reuse data for another purpose without consent | Chats are not used for training or ads. Asking for new consent is required before that ever changes. |
| 5.1.1(iii) | Collect only what the app needs | Projects, tasks, pins and Library items are the user's own content, stored for app features only and covered by the manifest's "other user content" entry. |
| Privacy manifest | `PrivacyInfo.xcprivacy` declares data and Required Reason APIs | `ios.privacyManifests` in `app.json`: no tracking; email, name, user ID, user content and product interaction for app functionality; the UserDefaults, FileTimestamp, SystemBootTime and DiskSpace reasons that React Native needs. Expo modules add their own manifests at build time. |

## Before every submission (manual)

- [ ] Re-read the guidelines if the date at the top is more than 30 days old, or Apple has announced changes.
- [ ] `npm run apple-check` passes.
- [ ] The production API is live with a real model and Supabase, and stays up during review.
- [ ] A reviewer account with a **password** is set up, and its details are in App Review notes. Email codes can't reach the reviewer.
- [ ] The review notes describe every feature, explain that there is no user-to-user content, and point to Report response and Contact support.
- [ ] `EXPO_PUBLIC_AI_PROVIDER` names whoever actually serves replies, and the privacy policy says the same.
- [ ] The privacy policy covers: the AI provider and what it receives, speech recognition by Apple, how to withdraw consent, retention, and account deletion.
- [ ] App Store Connect privacy labels match the privacy manifest.
- [ ] The age rating questionnaire is answered honestly for an open-ended AI chat app.
- [ ] Screenshots show the app in use and suit a 4+ audience (2.3.3, 2.3.8). No "for kids" wording.
- [ ] Nothing promised in onboarding or metadata is missing. **Urgent calls** are only a saved preference today: build them, or reword or remove that step before submitting.

## When subscriptions are added (3.1)

- Use in-app purchase (StoreKit) for Pro and Team. No links to outside payment.
- The paywall states the price, the period and what's included, and links the terms and privacy policy.
- Include **Restore purchases**. Subscriptions last at least 7 days and work on all the user's devices.
