// Builds the shareable web preview: a demo-mode web export whose URLs are
// relative, so it runs from any path, framed as a phone on wide screens.
// Usage: node scripts/build-preview.mjs [outDir]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? 'dist-preview');
fs.rmSync(out, { recursive: true, force: true });

execFileSync('npx', ['expo', 'export', '--platform', 'web', '--clear', '--output-dir', out], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_DEMO: '1', EXPO_OFFLINE: '1', CI: '1' },
});

// Absolute "/_expo" and "/assets" URLs -> relative ones (resolved against the
// <base> the demo boot step adds). "_expo" is renamed because the artifact host
// reserves top-level names starting with "_". Lazy route chunks are resolved
// against the page path, which the app resets to "/", so point them at the
// <base> URL as well.
fs.renameSync(path.join(out, '_expo'), path.join(out, 'expo'));
const relativize = (s) =>
  s
    .replaceAll('"/_expo/', '"expo/')
    .replaceAll('"_expo/', '"expo/')
    .replaceAll('"/assets/', '"assets/')
    .replaceAll('url:location.origin+location.pathname', 'url:document.baseURI');
for (const dir of ['expo/static/js/web']) {
  for (const f of fs.readdirSync(path.join(out, dir))) {
    const p = path.join(out, dir, f);
    fs.writeFileSync(p, relativize(fs.readFileSync(p, 'utf8')));
  }
}

const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const styles = [...html.matchAll(/<style[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

const page = `<title>Raco Preview</title>
<meta name="claude:viewport-fit-sides" content="cover">
${styles}
<style>
  :root { --ground: #EBEBED; --frame: #D6D6DB; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --ground: #2A2A2B; --frame: #141415; color-scheme: dark } }
  :root[data-theme="dark"] { --ground: #2A2A2B; --frame: #141415; color-scheme: dark }
  html, body { height: 100%; background: var(--ground); }
  /* On a phone the app fills the screen; on a wider screen it sits in a phone-sized frame. */
  @media (min-width: 600px) and (min-height: 760px) {
    body { display: flex; align-items: center; justify-content: center; background: var(--frame); }
    #root { width: 402px; height: min(874px, calc(100% - 48px)); flex: none; border-radius: 48px; overflow: hidden;
            background: var(--ground); box-shadow: 0 0 0 10px #1c1c1e, 0 30px 80px rgba(0,0,0,0.35); }
  }
</style>
${relativize(body).replaceAll('src="/_expo/', 'src="expo/')}`;

fs.writeFileSync(path.join(out, 'preview.html'), page);
console.log(`Preview written to ${out}/preview.html`);
