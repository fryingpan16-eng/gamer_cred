import { ACTION_COLORS, ACTION_KINDS } from '@/constants/actionColors';
import palettes from '@/constants/themePalettes.json';
import { STATUS_TOKENS, THEME_NAMES } from '@/constants/themes';

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('action colours (button faces fixed across themes)', () => {
  it('has save, cancel, danger, create and navigate', () => {
    expect(ACTION_KINDS.sort()).toEqual(['cancel', 'create', 'danger', 'navigate', 'save']);
  });

  it.each(ACTION_KINDS)('%s: button labels are readable in every state (≥ 4.5:1)', (kind) => {
    const c = ACTION_COLORS[kind];
    for (const face of [c.fill, c.hover, c.pressed]) expect(contrast(c.label, face)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEME_NAMES)('%s: the status text colours are readable on every surface (≥ 4.5:1)', (name) => {
    const t = palettes[name] as Record<string, string>;
    for (const token of STATUS_TOKENS) {
      for (const surface of ['dark', 'card', 'panel', 'button']) {
        expect(contrast(t[token]!, t[surface]!)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });


  it('start / add actions use the same bright green as save', () => {
    expect(ACTION_COLORS.create).toEqual(ACTION_COLORS.save);
  });

  it('labels are neutral (black or white), never tinted', () => {
    for (const kind of ACTION_KINDS) expect(['#0b0b0b', '#ffffff']).toContain(ACTION_COLORS[kind].label);
  });
});
