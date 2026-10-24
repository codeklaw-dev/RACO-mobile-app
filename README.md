# RACO

RACO's AI assistant app for iOS and Android, with its API and database.

| Path | What it is |
|---|---|
| `apps/mobile` | The app: Expo SDK 57 / React Native 0.86 (the SDK App Store Expo Go supports), Expo Router, TypeScript |
| `apps/api` | The API the app talks to: Hono on Node 22. Holds the AI keys, streams Claude replies, enforces quotas, records usage |
| `packages/shared` | Types and validation shared by the app and the API |
| `supabase/migrations` | Postgres schema with row level security |

## How it fits together

```
 phone app ──(Supabase Auth: email code, Apple, Google)──▶ Supabase
     │  reads own profile / chats directly (row level security)
     │
     └──(Bearer token, SSE)──▶ RACO API ──▶ Claude (Anthropic API)
                                   └──▶ Supabase (service role: messages, usage)
```

- **Multi-tenant from day one.** Every row belongs to a workspace. Sign-up creates
  a personal workspace; team workspaces (business tier) reuse the same tables.
  Chats stay private to their author even inside a team workspace.
- **Secrets never ship in the app.** The Anthropic key and the Supabase service
  role key live only on the API. The app holds the Supabase *publishable* key.
- **Sessions are stored in the Keychain / Keystore** (`expo-secure-store`), and
  the optional Face ID lock re-locks after a minute in the background.

## Running it locally

Requirements: Node 22, a Supabase project, an Anthropic API key.

```bash
npm install

# 1. Database: apply the schema (Supabase CLI, or paste the SQL into the SQL editor)
supabase link --project-ref <your-project-ref>
supabase db push

# 2. API
cp apps/api/.env.example apps/api/.env      # fill in the keys
npm run api                                 # http://localhost:8787

# 3. App
cp apps/mobile/.env.example apps/mobile/.env  # Supabase URL + publishable key, API URL
npm run mobile
```

### Trying the API without a database

`STORE=memory` keeps everything in memory and accepts the bearer token
`dev:<name>` as a login, so you can exercise the whole chat path with no
Supabase project. It is for local use only. With no model configured
(`LLM_PROVIDER=demo`, the default for now), chat streams sample replies and
voice onboarding uses the built-in rule-based reader.

```bash
npm run dev:local -w apps/api    # API on :8787
curl -N localhost:8787/v1/chat -H 'authorization: Bearer dev:sam' \
  -H 'content-type: application/json' -d '{"message":"Plan my week"}'
```

In Supabase, enable **Email** sign-in with a 6-digit code (Authentication → Email
templates: use `{{ .Token }}` in the template), and add **Apple** and **Google**
providers when you have their credentials. Add `raco://auth/callback` to the
allowed redirect URLs.

### Running on a phone or simulator

The app uses native modules (speech recognition, Face ID, Sign in with Apple,
secure storage), so it can't run in Expo Go. Build it with EAS instead.

**Try the feel on your own phone (demo build, no backend needed).** The
`preview` profile turns on demo mode: sample data and sample replies, any email
and the code `123456`.

```bash
cd apps/mobile
npx eas-cli@latest login                       # free Expo account
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest device:create               # iPhone: register it first (needs Apple Developer Program)
npx eas-cli@latest build --profile preview --platform ios
```

Each build ends with a link and QR code. Open it on the phone to install:
Android installs the APK directly (allow installing from your browser when
asked); an iPhone must be registered with `device:create` before the build,
and then needs Developer Mode on (Settings → Privacy & Security).

**Local builds** (connected phone or simulator):

```bash
npx expo run:ios          # macOS + Xcode
npx expo run:android      # Android Studio or a USB-connected phone
```

The `production` profile always has demo mode off. On a physical phone with a
real backend, set `EXPO_PUBLIC_API_URL` to a reachable address, not
`localhost`.

### Testing on several simulators

[simslim](https://github.com/MobAI-App/simslim) (macOS) turns off simulator
background services Raco doesn't use, cutting each iOS simulator from about
4 GB to under 1 GB, so you can run a small iPhone, a large one and an iPad side
by side.

Keep the `siri` group (speech recognition, used by voice onboarding and voice
mode) and the `store` group (push notifications, used by check-ins and urgent
calls):

```bash
brew install mobai-app/tap/simslim
xcrun simctl list devices               # find the simulator's UDID
simslim on <udid> --except siri,store   # slim it and reboot
simslim measure <udid>                  # memory footprint
simslim off <udid>                      # back to stock
```

For layout-only checks where voice and notifications don't matter, plain
`simslim on <udid>` is the lightest.

## Checks

```bash
npm run typecheck   # all workspaces
npm test            # API route tests + app logic tests
npm run lint
```

## Status

Built: email-code / password / Apple / Google sign-in, Face ID lock, the typed
onboarding flow (designs 05–11), home and first-run screens (12, 13), streaming
chat with Markdown, chat history, settings, account deletion, light and dark mode.

Next: voice-led onboarding (designs V1–V6), voice mode, dictation, file uploads,
connectors, reminder calls, subscriptions.
