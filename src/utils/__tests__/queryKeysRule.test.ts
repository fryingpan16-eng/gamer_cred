// Node built-ins, typed locally (the app's tsconfig has no Node types).
/* eslint-disable @typescript-eslint/no-require-imports */
const { readdirSync, readFileSync, statSync } = require('fs') as {
  readdirSync: (path: string) => string[];
  readFileSync: (path: string, encoding: 'utf8') => string;
  statSync: (path: string) => { isDirectory: () => boolean };
};
const { join } = require('path') as { join: (...parts: string[]) => string };
/* eslint-enable @typescript-eslint/no-require-imports */
declare const __dirname: string;

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
