/// <reference types="node" />
/**
 * Open-source licenses shown in Settings → About → Open-source licenses.
 *
 * Bundles the app (Android + web) with source maps, collects every package
 * that actually ships in a bundle, and writes their license texts to
 * src/constants/openSourceLicenses.json (identical texts stored once).
 *
 *   npm run licenses        (run before each store / APK build)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

type PackageJson = { name?: string; version?: string; license?: unknown; licenses?: unknown; repository?: unknown; homepage?: string };
type Entry = { name: string; version: string; license: string; url: string | null; text: number };

const root = join(import.meta.dirname, '..');

/**
 * Native Android libraries the app ships that aren't npm packages (React
 * Native's own native dependencies). Review when React Native is upgraded.
 */
const NATIVE_LIBRARIES: { name: string; license: 'Apache-2.0' | 'MIT'; url: string }[] = [
  { name: 'AndroidX (Android Jetpack)', license: 'Apache-2.0', url: 'https://developer.android.com/jetpack/androidx' },
  { name: 'Kotlin standard library', license: 'Apache-2.0', url: 'https://github.com/JetBrains/kotlin' },
  { name: 'OkHttp / Okio', license: 'Apache-2.0', url: 'https://github.com/square/okhttp' },
  { name: 'Fresco', license: 'MIT', url: 'https://github.com/facebook/fresco' },
  { name: 'Hermes', license: 'MIT', url: 'https://github.com/facebook/hermes' },
  { name: 'SoLoader', license: 'Apache-2.0', url: 'https://github.com/facebook/SoLoader' },
];
/** The full Apache 2.0 text, taken from a package that ships it verbatim. */
const APACHE_TEXT_FILE = 'node_modules/typescript/LICENSE.txt';
const MIT_NATIVE_TEXT = (name: string) =>
  `${name} is licensed under the MIT License.\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n\nCopyright (c) Meta Platforms, Inc. and affiliates.`;
const outFile = join(root, 'src/constants/openSourceLicenses.json');

function walkFiles(dir: string, found: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, found);
    else if (e.name.endsWith('.map')) found.push(p);
  }
  return found;
}

/** ".../node_modules/@scope/pkg/lib/x.js" → ".../node_modules/@scope/pkg" (innermost package). */
function packageDir(source: string): string | null {
  const marker = '/node_modules/';
  const at = source.lastIndexOf(marker);
  if (at < 0) return null;
  const rest = source.slice(at + marker.length).split('/');
  const parts = rest[0]?.startsWith('@') ? rest.slice(0, 2) : rest.slice(0, 1);
  return source.slice(0, at + marker.length) + parts.join('/');
}

function licenseName(pkg: PackageJson): string {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license === 'object' && 'type' in pkg.license) return String((pkg.license as { type: unknown }).type);
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l: { type?: string }) => l.type ?? '?').join(' OR ');
  return 'See package';
}

function repoUrl(pkg: PackageJson): string | null {
  const r = typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository as { url?: string } | undefined)?.url;
  const url = (r ?? pkg.homepage ?? '').replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://');
  if (/^github:/.test(url)) return `https://github.com/${url.slice(7)}`;
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) return `https://github.com/${url}`;
  return /^https?:\/\//.test(url) ? url : null;
}

const work = mkdtempSync(join(tmpdir(), 'gc-licenses-'));
try {
  console.log('Bundling the app to find what ships (about a minute)…');
  execFileSync('npx', ['expo', 'export', '-p', 'android', '-p', 'web', '--source-maps', '--output-dir', work], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  const dirs = new Set<string>();
  for (const map of walkFiles(work)) {
    type SourceMap = { sources?: string[]; sections?: { map: SourceMap }[] };
    const flatten = (m: SourceMap): string[] => [...(m.sources ?? []), ...(m.sections ?? []).flatMap((x) => flatten(x.map))];
    for (const s of flatten(JSON.parse(readFileSync(map, 'utf8')) as SourceMap)) {
      const dir = packageDir(s.startsWith(root) ? s : join(root, s)); // Metro writes "/node_modules/…" relative to the project
      if (dir && existsSync(join(dir, 'package.json'))) dirs.add(dir);
    }
  }
  // Direct dependencies with native code only (e.g. expo-splash-screen) never appear in a JS bundle.
  const own = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
  for (const name of Object.keys(own.dependencies)) {
    const dir = join(root, 'node_modules', name);
    if (existsSync(join(dir, 'package.json'))) dirs.add(dir);
  }

  const texts: string[] = [];
  const textIndex = new Map<string, number>();
  const addText = (body: string) => {
    let id = textIndex.get(body);
    if (id === undefined) {
      id = texts.push(body) - 1;
      textIndex.set(body, id);
    }
    return id;
  };
  const byName = new Map<string, Entry>();
  const apache = readFileSync(join(root, APACHE_TEXT_FILE), 'utf8').trim();
  for (const lib of NATIVE_LIBRARIES) {
    const text = addText(lib.license === 'Apache-2.0' ? apache : MIT_NATIVE_TEXT(lib.name));
    byName.set(lib.name, { name: lib.name, version: 'Android', license: lib.license, url: lib.url, text });
  }
  for (const dir of [...dirs].sort()) {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as PackageJson;
    if (!pkg.name || pkg.name === 'gamercred') continue;
    const files = readdirSync(dir).filter((f) => /^(licen[cs]e|copying|notice)/i.test(f)).sort();
    const license = licenseName(pkg);
    const body =
      files.map((f) => readFileSync(join(dir, f), 'utf8').trim()).join('\n\n') ||
      `${pkg.name} is licensed under ${license}. No license file is included in the package; see its source repository.`;
    const id = addText(body);
    const key = `${pkg.name}@${pkg.version ?? ''}`;
    if (!byName.has(key)) byName.set(key, { name: pkg.name, version: pkg.version ?? '', license, url: repoUrl(pkg), text: id });
  }

  const packages = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  writeFileSync(outFile, JSON.stringify({ packages, texts }) + '\n');
  console.log(`${packages.length} packages, ${texts.length} distinct license texts → ${relative(root, outFile)}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
