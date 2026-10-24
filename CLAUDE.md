# Raco

Premium AI assistant app (iOS and Android) that will be published to the App
Store and Google Play. Monorepo: `apps/mobile` (Expo), `apps/api` (Hono),
`packages/shared`, `supabase/migrations`. See README.md for setup.

## App Store compliance comes first

Every change must keep the app able to pass App Review.

- Read `APPLE_COMPLIANCE.md` before working on anything it covers: sign-in,
  onboarding, chat, data sent to the AI provider, permissions, notifications,
  payments, account deletion, metadata.
- Apple updates its rules. Before a release, or when the "Last checked" date
  in `APPLE_COMPLIANCE.md` is more than 30 days old, check
  <https://developer.apple.com/app-store/review/guidelines/> and Apple's
  Developer News for changes. Update the doc and `scripts/apple-check.mjs` to
  match, and bump the dates.
- Run `npm run apple-check` after changes in those areas. It must pass.
- Never send user data to an AI provider without the saved consent
  (`profiles.ai_consent_at`). Never ship demo mode in a production build.
- A new feature that collects data, needs a permission or takes payment must
  update the privacy manifest, purpose strings and the compliance doc in the
  same change.

## Checks

```bash
npm run apple-check
cd apps/api && npx tsc --noEmit && npx vitest run
cd apps/mobile && npx tsc --noEmit && npx eslint src && npx vitest run
cd packages/shared && npx vitest run
```
