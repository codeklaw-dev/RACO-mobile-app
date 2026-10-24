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

## Expo Go compatibility

The app must always open in Expo Go from the App Store and Play Store.

- Keep `expo` on the SDK in `apps/mobile/package.json` → `expoGo.sdk`. Expo
  ships store Expo Go for a new SDK weeks after the SDK itself; only upgrade
  once it is out (check expo.dev/changelog), then bump `expoGo.sdk`.
- Upgrade with `npx expo install expo@^<sdk> --fix`, and keep the root
  `overrides` for react, react-dom and react-native equal to the mobile app's
  versions so there is only one copy of each.
- Only use native modules that Expo Go includes, or load others lazily with a
  fallback (see `src/lib/voice.ts`). `npm run apple-check` checks the SDK.

## Merging

Squash, and keep our own commits on `main`. GitHub's merge or squash button
makes GitHub the committer, which shows as unverified, so instead:

1. Squash the branch into one commit with a clear message.
2. Open the pull request (`gh api`, base `main`) so the change is reviewable.
3. Fast-forward `main` to that commit: `git push origin <branch>:main`.
   GitHub then marks the pull request as merged.

Never rewrite or force-push `main`.

## Checks

```bash
npm run apple-check
cd apps/api && npx tsc --noEmit && npx vitest run
cd apps/mobile && npx tsc --noEmit && npx eslint src && npx vitest run
cd packages/shared && npx vitest run
```
