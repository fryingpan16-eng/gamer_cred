import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/** CLAUDE.md: every TanStack Query key comes from src/utils/queryKeys.ts — none built by hand. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('query keys', () => {
  it('are never written as inline arrays', () => {
    const root = join(__dirname, '..', '..', '..');
    const offenders = [...sourceFiles(join(root, 'src')), ...sourceFiles(join(root, 'app'))].filter((file) =>
      /queryKey:\s*\[/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
