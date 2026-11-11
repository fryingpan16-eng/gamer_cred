/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import licenses from '@/constants/openSourceLicenses.json';

import pkg from '../../../package.json';

// Fails when a dependency is added or upgraded without `npm run licenses`.
describe('open-source licenses list', () => {
  const listed = new Map(licenses.packages.map((p) => [p.name, p.version]));

  it('lists every direct dependency at its installed version', () => {
    const missing = Object.keys(pkg.dependencies).filter((name) => {
      const file = join(__dirname, '../../../node_modules', name, 'package.json');
      const installed = (JSON.parse(readFileSync(file, 'utf8')) as { version: string }).version;
      return listed.get(name) !== installed;
    });
    expect(missing).toEqual([]);
  });

  it('every entry has license text', () => {
    for (const p of licenses.packages) expect(licenses.texts[p.text]?.length ?? 0).toBeGreaterThan(20);
  });
});
