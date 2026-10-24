// Pre-submission App Store compliance check. Static checks against this repo
// for the rules in APPLE_COMPLIANCE.md; it can't replace reading the current
// guidelines, so it also warns when the doc hasn't been re-checked recently.
// Usage: npm run apple-check
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const files = (dir, out = []) => {
  for (const name of readdirSync(join(root, dir))) {
    const p = join(dir, name);
    if (statSync(join(root, p)).isDirectory()) files(p, out);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
};
const source = (dir) =>
  files(dir)
    .map((p) => read(p))
    .join('\n');

const app = json('apps/mobile/app.json').expo;
const eas = json('apps/mobile/eas.json');
const mobile = source('apps/mobile/src');
const api = source('apps/api/src');
const plugin = (name) => app.plugins.find((p) => (Array.isArray(p) ? p[0] : p) === name);
const pluginOpt = (name, key) => (Array.isArray(plugin(name)) ? plugin(name)[1]?.[key] : undefined);
const manifest = app.ios?.privacyManifests ?? {};

const checks = [
  [
    'Purpose strings for microphone, speech recognition and Face ID (5.1.1)',
    () =>
      [
        pluginOpt('expo-speech-recognition', 'microphonePermission'),
        pluginOpt('expo-speech-recognition', 'speechRecognitionPermission'),
        pluginOpt('expo-local-authentication', 'faceIDPermission'),
      ].every((s) => typeof s === 'string' && s.length > 20),
  ],
  [
    'Privacy manifest: no tracking, data types declared',
    () => manifest.NSPrivacyTracking === false && (manifest.NSPrivacyCollectedDataTypes ?? []).length > 0,
  ],
  [
    'Required Reason APIs declared with reasons',
    () =>
      ['UserDefaults', 'FileTimestamp', 'SystemBootTime', 'DiskSpace'].every((c) =>
        (manifest.NSPrivacyAccessedAPITypes ?? []).some(
          (t) => t.NSPrivacyAccessedAPIType === `NSPrivacyAccessedAPICategory${c}` && t.NSPrivacyAccessedAPITypeReasons?.length,
        ),
      ),
  ],
  [
    'Sign in with Apple offered alongside Google (4.8)',
    () => !/google/i.test(mobile) || (app.ios?.usesAppleSignIn === true && /signInWithApple|AppleAuthentication/.test(mobile)),
  ],
  ['Account deletion in the app (5.1.1(v))', () => /app\.delete\('\/v1\/account'/.test(api) && /Delete account/.test(mobile)],
  [
    'Explicit consent before data goes to the AI service (5.1.2(i))',
    () =>
      /ctx\.aiConsent/.test(api) &&
      /consent_required/.test(api) &&
      /useAiConsent\(\)/.test(read('apps/mobile/src/state/use-chat.ts')) &&
      /aiConsent\.ensure\(\)/.test(read('apps/mobile/src/app/(onboarding)/voice.tsx')),
  ],
  ['Users can report AI responses (1.2)', () => /'\/v1\/reports'/.test(api) && /Report response/.test(mobile)],
  [
    'Privacy policy, terms and support contact in Settings (1.5, 5.1.1(i))',
    () => {
      const s = read('apps/mobile/src/app/(app)/settings.tsx');
      return /privacyUrl/.test(s) && /termsUrl/.test(s) && /supportEmail/.test(s);
    },
  ],
  [
    'Production build has demo mode off (2.1, 2.3.1)',
    () => eas.build?.production?.env?.EXPO_PUBLIC_DEMO === '0' && /LLM_PROVIDER=demo is not allowed in production/.test(api),
  ],
  ['No downloaded or evaluated code (2.5.2)', () => !/\beval\(|new Function\(/.test(mobile)],
  ['No payment links outside in-app purchase (3.1.1)', () => !/stripe|paypal|checkout\.|buy\.|\/pricing/i.test(mobile)],
  [
    'Face ID through LocalAuthentication (2.5.13)',
    () => /expo-local-authentication/.test(mobile) && !/ARKit|expo-face-detector/.test(mobile),
  ],
];

let failed = 0;
console.log('Running pre-submission App Store compliance check...\n');
for (const [name, test] of checks) {
  let ok = false;
  try {
    ok = Boolean(test());
  } catch {}
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${name}`);
}

// The guidelines change; the doc records when they were last compared.
const reviewed = read('APPLE_COMPLIANCE.md').match(/Last checked against the guidelines:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
const ageDays = reviewed ? (Date.now() - Date.parse(reviewed)) / 86_400_000 : Infinity;
console.log('');
if (ageDays > 30) console.log(`  ! APPLE_COMPLIANCE.md was last checked ${reviewed ?? 'never'}. Re-read the guidelines before submitting.`);
if (failed) {
  console.log(`\n${failed} of ${checks.length} checks failed. Not ready to submit.`);
  process.exit(1);
}
console.log(`All ${checks.length} checks passed. Also work through the manual list in APPLE_COMPLIANCE.md.`);
