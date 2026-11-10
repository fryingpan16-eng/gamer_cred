"""Generate src/constants/themePalettes.json (RetroGamingPC colour themes).

Design (high contrast):
  * Dark themes: surfaces (window, panels, cards, buttons, borders, bevels) are
    dark and tinted by the theme hue. Every non-olive dark theme is the olive base
    hue-rotated with each surface token's relative luminance held equal, so
    contrast is identical across them.
  * The light theme ("white") is hand-picked: white and silver surfaces with a
    sky-blue accent and dark text.
  * Text tokens are NEUTRAL greys (no colour tint): one set for the dark themes,
    one for the light theme.
  * Status tokens (error, save/cancel/navigate text, like, gold) mean the same
    thing in every theme; the light theme uses darker shades so they stay readable.

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

# Status colours on the dark themes (same in every dark theme).
STATUS_DARK = {
    'error': '#ff8a7a',
    'save-text': '#5fe07f',
    'cancel-text': '#ff8a7a',
    'navigate-text': '#7ab8ff',
    'like': '#ff7a9a',
    'gold': '#ffd54a',
}

# The light theme: white + silver surfaces, sky-blue accent.
WHITE = {
    'dark': '#e8ecf0',          # page / window background (silver)
    'card': '#f8fafc',          # panels, cards (near white)
    'panel': '#dfe5eb',         # headers, title bars
    'accent': '#c2cbd5',        # dividers, tab outlines
    'highlight': '#07629a',     # focus rings, meters, stars (sky blue, dark enough on white)
    'button': '#f1f4f7',        # button surfaces
    'button-border': '#9aa6b3', # button outlines
    'active': '#9ad8f5',        # primary buttons, selected chips (dark text on top)
    'bevel-light': '#ffffff',
    'bevel-dark': '#8692a0',
}
NEUTRAL_LIGHT = {
    'text-bright': '#111111',
    'text': '#222222',
    'text-muted': '#555555',
    'ink': '#ffffff',           # text on the highlight colour (badges)
}
STATUS_LIGHT = {
    'error': '#b3261e',
    'save-text': '#0b6b25',
    'cancel-text': '#b3261e',
    'navigate-text': '#0b5aa8',
    'like': '#c2185b',
    'gold': '#664700',
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


def palette(surfaces, text=NEUTRAL, status=STATUS_DARK):
    # Key order is the token order Tailwind sees: surfaces, then text, then status.
    return {**surfaces, **text, **status}


themes = {'olive': palette(OLIVE)}
for name, (hue, sat_mul) in TARGETS.items():
    themes[name] = palette({k: rotate(v, hue, sat_mul) for k, v in OLIVE.items()})
themes['white'] = palette(WHITE, NEUTRAL_LIGHT, STATUS_LIGHT)

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
    worst = min(contrast(p[t], p[s]) for t in STATUS_DARK for s in ('dark', 'card', 'panel', 'button'))
    hl = min(contrast(p['highlight'], p[s]) for s in ('dark', 'card', 'panel', 'button'))
    print(f"        status worst {worst:5.2f}  highlight worst {hl:5.2f}")
