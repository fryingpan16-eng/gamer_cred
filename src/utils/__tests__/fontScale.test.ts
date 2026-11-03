type FontSize = [string, { lineHeight: string }];
type Config = {
  theme: { extend: { fontSize: Record<string, FontSize> } };
  plugins: ((api: Record<string, (rules: Record<string, Record<string, Record<string, string>>>) => void>) => void)[];
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../../../tailwind.config.js') as Config;

describe('type scale', () => {
  it('phones get every size 10% larger; ≥ md restores the compact desktop sizes', () => {
    let desktop: Record<string, Record<string, string>> = {};
    for (const plugin of config.plugins) {
      plugin({ addBase: () => {}, addUtilities: (rules) => (desktop = rules['@media (min-width: 768px)'] ?? desktop) });
    }
    const names = Object.keys(config.theme.extend.fontSize);
    expect(names).toEqual(expect.arrayContaining(['retrogamingpc-xs', 'retrogamingpc-base', 'retrogamingpc-xl']));
    for (const name of names) {
      const [mobileSize, { lineHeight: mobileLine }] = config.theme.extend.fontSize[name]!;
      const d = desktop[`.text-${name}`]!;
      expect(parseFloat(mobileSize)).toBeCloseTo(parseFloat(d.fontSize!) * 1.1, 1);
      expect(parseFloat(mobileLine)).toBeCloseTo(parseFloat(d.lineHeight!) * 1.1, 1);
    }
    // CLAUDE.md minimum: text ≥ 10px everywhere.
    expect(parseFloat(desktop['.text-retrogamingpc-xs']!.fontSize!)).toBeGreaterThanOrEqual(10);
  });
});
