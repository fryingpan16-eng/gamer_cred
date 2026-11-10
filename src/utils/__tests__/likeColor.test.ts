import { THEME_NAMES, themePalette } from '@/constants/themes';
import { contrast } from '@/utils/color';

describe('like colour', () => {
  it.each(THEME_NAMES)('%s: the heart and its count are readable on every surface', (name) => {
    const t = themePalette(name);
    for (const bg of [t.dark, t.card, t.panel, t.button]) expect(contrast(t.like, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
