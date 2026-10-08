// Syntax-checks every script and validates the manifest. No dependencies needed.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
})(root);
for (const f of files) execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' });

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const must = [manifest.background.service_worker, manifest.action.default_popup, manifest.options_ui.page,
  ...manifest.content_scripts.flatMap(c => [...c.js, ...(c.css || [])]), ...Object.values(manifest.icons)];
for (const rel of must) if (!existsSync(join(root, rel))) throw new Error('manifest references missing file: ' + rel);
if (manifest.manifest_version !== 3) throw new Error('manifest_version must be 3');
console.log(`checked ${files.length} scripts, manifest ok (v${manifest.version})`);
