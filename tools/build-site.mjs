// Builds every game in games/ into a static site under site/ with an index page.
// Usage: npm run site
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gamesDir = join(root, 'games');
const siteDir = join(root, 'site');

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// First prose paragraph of a README (skips headings and blank blocks).
function readmeIntro(path) {
  if (!existsSync(path)) return '';
  const blocks = readFileSync(path, 'utf8').split(/\r?\n\s*\r?\n/);
  for (const block of blocks) {
    const text = block.trim();
    if (text && !text.startsWith('#')) return text.replace(/\s+/g, ' ');
  }
  return '';
}

rmSync(siteDir, { recursive: true, force: true });
mkdirSync(siteDir, { recursive: true });

const games = [];
for (const name of readdirSync(gamesDir).sort()) {
  const gameDir = join(gamesDir, name);
  if (!statSync(gameDir).isDirectory()) continue;
  const pkgPath = join(gameDir, 'package.json');
  if (!existsSync(pkgPath)) continue;
  const pkg = readJson(pkgPath);
  if (!pkg.scripts || !pkg.scripts.build) continue;

  try {
    execSync(`npm run build -w games/${name}`, { cwd: root, stdio: 'inherit', shell: true });
  } catch (err) {
    console.error(`Build failed for games/${name}`);
    process.exit(1);
  }

  cpSync(join(gameDir, 'dist'), join(siteDir, name), { recursive: true });
  const description = pkg.description || readmeIntro(join(gameDir, 'README.md'));
  games.push({ name, description });
}

const cards = games
  .map(
    ({ name, description }) => `    <a class="card" href="./${escapeHtml(name)}/">
      <h2>${escapeHtml(name)}</h2>
      ${description ? `<p>${escapeHtml(description)}</p>` : ''}
    </a>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Gnome Testbed Arcade</title>
  <style>
    body { margin: 0; padding: 32px 16px; background: #121417; color: #e8e8e8; font-family: system-ui, sans-serif; }
    h1 { text-align: center; margin: 0 0 24px; }
    .grid { display: grid; gap: 16px; max-width: 960px; margin: 0 auto; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .card { display: block; padding: 20px; border-radius: 12px; background: #1d2127; color: inherit; text-decoration: none; border: 1px solid #2c323b; }
    .card:hover { border-color: #5b8def; }
    .card h2 { margin: 0 0 8px; font-size: 1.2rem; }
    .card p { margin: 0; color: #a7adb6; line-height: 1.4; }
  </style>
</head>
<body>
  <h1>Gnome Testbed Arcade</h1>
  <main class="grid">
${cards}
  </main>
</body>
</html>
`;

writeFileSync(join(siteDir, 'index.html'), html);
writeFileSync(join(siteDir, '.nojekyll'), '');
console.log(`Site built: ${games.length} game(s) in ${siteDir}`);
