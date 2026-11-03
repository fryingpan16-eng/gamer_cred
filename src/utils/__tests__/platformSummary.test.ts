import { pcSpecsSummary } from '../platformSummary';
import { EMPTY_PC_SPECS } from '../profileSchemas';

describe('pcSpecsSummary', () => {
  it('shows CPU, GPU and RAM', () => {
    expect(pcSpecsSummary({ ...EMPTY_PC_SPECS, cpu: 'Ryzen 7', gpu: 'RTX 4070', ram: '32 GB', os: 'Windows 11' })).toBe(
      'Ryzen 7 · RTX 4070 · 32 GB',
    );
  });

  it('falls back to OS and storage', () => {
    expect(pcSpecsSummary({ ...EMPTY_PC_SPECS, os: 'macOS', storage: '1 TB' })).toBe('macOS · 1 TB');
  });

  it('is empty with no specs', () => {
    expect(pcSpecsSummary(null)).toBe('');
    expect(pcSpecsSummary(EMPTY_PC_SPECS)).toBe('');
  });
});
