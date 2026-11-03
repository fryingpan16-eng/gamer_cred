"""Generate src/constants/themePalettes.json (RetroGamingPC colour themes).

Design (high-contrast dark mode):
  * Surfaces (window, panels, cards, buttons, borders, bevels) are dark and tinted
    by the theme hue.
  * Text tokens are NEUTRAL greys, identical in every theme (no colour tint).
  * Every non-olive theme is the olive base hue-rotated with each surface token's
    relative luminance held equal, so contrast is identical across themes.

Run from the repo root:  python3 scripts/generate-theme-palettes.py
"""
import colorsys
import json

# Olive base — the default theme. Hex values, dark-mode brightness.
OLIVE = {
    'dark': '#181a15',          # page / window background
    'card': '#20231c',          # panels, cards
    'panel': '#292d24',         # headers, title bars, raised surfaces
    'accent': '#3a4031',        # dividers, tab outlines
    'highlight': '#b4c491',     # focus rings, active borders, meters, stars
    'button': '#272b21',        # button surfaces
    'button-border': '#4a5240', # button outlines
    'active': '#55643a',        # primary buttons, selected chips (white text on top)
    'bevel-light': '#454c3a',   # bevel top/left edge
    'bevel-dark': '#0a0b08',    # bevel bottom/right edge, desktop backdrop
}

# Neutral, theme-independent text (no hue at all).
NEUTRAL = {
    'text-bright': '#fafafa',   # headings, key values
    'text': '#e6e6e6',          # body text
    'text-muted': '#b8b8b8',    # meta / secondary text
    'ink': '#101010',           # text on light coloured surfaces (badges)
}

# Target hue (degrees) and saturation multiplier for each non-default theme.
TARGETS = {'blue': (212, 1.3), 'red': (356, 1.3), 'yellow': (46, 1.4), 'pink': (326, 1.25)}


def rgb(hexstr):
    h = hexstr.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def to_hex(r, g, b):
    return '#%02x%02x%02x' % tuple(round(max(0, min(1, c)) * 255) for c in (r, g, b))


def luminance(hexstr):
    def ch(v):
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb(hexstr)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def rotate(hexstr, hue, sat_mul):
    """Rotate to `hue`, scale saturation, then match the original's relative luminance."""
    _, light, sat = colorsys.rgb_to_hls(*rgb(hexstr))
    sat = min(1, sat * sat_mul)
    target = luminance(hexstr)
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if luminance(to_hex(*colorsys.hls_to_rgb(hue / 360, mid, sat))) < target:
            lo = mid
        else:
            hi = mid
    return to_hex(*colorsys.hls_to_rgb(hue / 360, (lo + hi) / 2, sat))


def palette(surfaces):
    # Key order is the token order Tailwind sees; keep text tokens grouped after surfaces.
    return {**surfaces, **NEUTRAL}


themes = {'olive': palette(OLIVE)}
for name, (hue, sat_mul) in TARGETS.items():
    themes[name] = palette({k: rotate(v, hue, sat_mul) for k, v in OLIVE.items()})

with open('src/constants/themePalettes.json', 'w') as f:
    json.dump(themes, f, indent=2)
    f.write('\n')


def contrast(a, b):
    hi, lo = sorted((luminance(a), luminance(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


for name, p in themes.items():
    print(
        f"{name:7s} text/dark {contrast(p['text'], p['dark']):5.2f}  text/panel {contrast(p['text'], p['panel']):5.2f}  "
        f"muted/card {contrast(p['text-muted'], p['card']):5.2f}  muted/panel {contrast(p['text-muted'], p['panel']):5.2f}  "
        f"bright/active {contrast(p['text-bright'], p['active']):5.2f}  ink/highlight {contrast(p['ink'], p['highlight']):5.2f}"
    )
