import type { PcSpecs } from './profileSchemas';

/** One-line spec summary for a compact row, e.g. "Ryzen 7 7800X3D · RTX 4070 · 32 GB". Empty when nothing is entered. */
export function pcSpecsSummary(specs: PcSpecs | null): string {
  if (!specs) return '';
  const parts = [specs.cpu, specs.gpu, specs.ram].filter((v) => v.length > 0);
  // Fall back to OS / storage so a sheet with only those still shows something.
  return (parts.length > 0 ? parts : [specs.os, specs.storage].filter((v) => v.length > 0)).join(' · ');
}
