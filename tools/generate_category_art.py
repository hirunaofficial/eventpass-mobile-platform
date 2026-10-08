#!/usr/bin/env python3
"""
Generates EventPass's category artwork.

Every illustration in this app is produced by THIS script from geometric
primitives - rectangles, circles, arcs, polygons and hand-written paths.
Nothing is traced, downloaded, or derived from existing artwork. The
script is kept in the repository as provenance: the output can always be
regenerated from source, which is what makes it self-authored.

Design system ("Night Press", 2026-10-08):
  - FLAT TWO-COLOUR, no gradients. The previous version used smooth
    violet/magenta linear gradients, which is the clearest fingerprint
    of AI-generated artwork. Screen-print language replaces it: one
    flat ink per category on a warm paper tone.
  - HALFTONE GRAIN. A dot screen of varying radius stands in for tone,
    the way a two-colour riso print does. This is the texture that
    smooth digital gradients cannot fake.
  - MISREGISTRATION. A second, offset copy of the glyph in the accent
    ink, a few pixels out of alignment - the signature flaw of real
    screen printing, and something no generator produces on purpose.
  - Each category owns ONE ink, drawn from a warm print palette. No
    purple, no blue-violet.

Usage:  python3 tools/generate_category_art.py
Requires rsvg-convert (brew install librsvg).
"""

import subprocess
from pathlib import Path

W, H = 1200, 900
OUT = Path(__file__).resolve().parent.parent / "app/src/assets/event-categories"

# category -> (ink, paper). One flat ink each, warm print palette.
# Deliberately no purple or blue-violet anywhere in this set.
PALETTE = {
    "tech":      ("#D94F1E", "#141210"),
    "music":     ("#E8FF52", "#141210"),
    "art":       ("#E5574F", "#141210"),
    "business":  ("#C9A227", "#141210"),
    "comedy":    ("#F08A24", "#141210"),
    "wellness":  ("#7FA650", "#141210"),
    "film":      ("#D8CFC0", "#141210"),
    "sports":    ("#E2452C", "#141210"),
    "food":      ("#E07B39", "#141210"),
    "workshop":  ("#B5C94A", "#141210"),
    "classical": ("#D9B65C", "#141210"),
}


def frame(key: str) -> str:
    """Flat paper, halftone screen, registration marks.

    No gradient and no glow - that is the whole point. Tone comes from
    a dot screen whose radius falls off across the canvas, which is how
    a two-colour print actually renders a gradient."""
    ink, paper = PALETTE[key]

    # Halftone: dot radius shrinks left-to-right and top-to-bottom, so
    # the screen reads as a diagonal tonal sweep built from solid dots.
    dots = []
    cols, rows = 30, 23
    for r in range(rows):
        for c in range(cols):
            t = (c / cols) * 0.6 + (r / rows) * 0.4
            rad = round(max(0.0, 9.5 * (1.0 - t)), 2)
            if rad < 0.4:
                continue
            cx = 20 + c * 40 + (20 if r % 2 else 0)
            cy = 20 + r * 40
            dots.append(f'<circle cx="{cx}" cy="{cy}" r="{rad}" fill="{ink}"/>')

    return f"""
  <rect width="{W}" height="{H}" fill="{paper}"/>
  <g opacity="0.30">{''.join(dots)}</g>

  <!-- registration marks: printer's crosshairs, trimmed by the frame -->
  <g stroke="{ink}" stroke-width="3" opacity="0.5">
    <line x1="56" y1="56" x2="56" y2="104"/><line x1="32" y1="80" x2="80" y2="80"/>
    <line x1="{W-56}" y1="{H-56}" x2="{W-56}" y2="{H-104}"/>
    <line x1="{W-32}" y1="{H-80}" x2="{W-80}" y2="{H-80}"/>
  </g>

  <!-- perforation ticks: family resemblance to the ticket mark -->
  <g fill="{ink}" opacity="0.5">
    <circle cx="0" cy="{H//2}" r="24"/>
    <circle cx="{W}" cy="{H//2}" r="24"/>
  </g>
"""


# --- Per-category glyphs. Each is drawn around centre (600, 450). ------

def tech() -> str:
    nodes = [(380, 300), (600, 240), (820, 330), (430, 560), (690, 600), (600, 430)]
    traces = "".join(
        f'<line x1="{x1}" y1="{y1}" x2="600" y2="430" stroke="#FFFFFF" '
        f'stroke-width="6" opacity="0.5" stroke-linecap="round"/>'
        for (x1, y1) in nodes[:-1]
    )
    pts = "".join(
        f'<circle cx="{x}" cy="{y}" r="26" fill="#FFFFFF" opacity="0.92"/>'
        f'<circle cx="{x}" cy="{y}" r="12" fill="#0A0A0C" opacity="0.74"/>'
        for (x, y) in nodes[:-1]
    )
    return f"""
  <rect x="470" y="300" width="260" height="260" rx="48" fill="#FFFFFF" opacity="0.12"/>
  {traces}{pts}
  <circle cx="600" cy="430" r="54" fill="#FFFFFF"/>
  <circle cx="600" cy="430" r="24" fill="#0A0A0C" opacity="0.74"/>
"""


def music() -> str:
    bars = [(0, 150), (1, 250), (2, 340), (3, 210), (4, 300), (5, 130)]
    rects = "".join(
        f'<rect x="{430 + i * 60}" y="{560 - h}" width="34" height="{h}" rx="17" '
        f'fill="#FFFFFF" opacity="{0.55 + 0.07 * i:.2f}"/>'
        for (i, h) in bars
    )
    waves = "".join(
        f'<circle cx="600" cy="450" r="{r}" fill="none" stroke="#FFFFFF" '
        f'stroke-width="5" opacity="{0.22 - i * 0.05:.2f}"/>'
        for i, r in enumerate((300, 360, 420))
    )
    return f"{waves}{rects}"


def art() -> str:
    return """
  <circle cx="560" cy="430" r="185" fill="#FFFFFF" opacity="0.14"/>
  <circle cx="500" cy="360" r="52" fill="#FFFFFF" opacity="0.92"/>
  <circle cx="630" cy="340" r="44" fill="#FFFFFF" opacity="0.72"/>
  <circle cx="690" cy="450" r="38" fill="#FFFFFF" opacity="0.55"/>
  <circle cx="540" cy="520" r="46" fill="#FFFFFF" opacity="0.80"/>
  <rect x="700" y="250" width="26" height="300" rx="13" fill="#FFFFFF"
        opacity="0.95" transform="rotate(24 713 400)"/>
  <polygon points="760,560 800,600 735,612" fill="#FFFFFF" opacity="0.95"/>
"""


def business() -> str:
    bars = [(0, 140), (1, 220), (2, 300), (3, 400)]
    rects = "".join(
        f'<rect x="{420 + i * 95}" y="{600 - h}" width="62" height="{h}" rx="16" '
        f'fill="#FFFFFF" opacity="{0.45 + 0.17 * i:.2f}"/>'
        for (i, h) in bars
    )
    return f"""
  <rect x="380" y="240" width="440" height="400" rx="40" fill="#FFFFFF" opacity="0.10"/>
  {rects}
  <path d="M430 420 L525 350 L620 390 L735 250" fill="none" stroke="#FFFFFF"
        stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <polygon points="700,244 760,236 752,296" fill="#FFFFFF"/>
"""


def comedy() -> str:
    return """
  <polygon points="600,180 840,660 360,660" fill="#FFFFFF" opacity="0.16"/>
  <rect x="566" y="430" width="68" height="190" rx="34" fill="#FFFFFF" opacity="0.95"/>
  <circle cx="600" cy="400" r="84" fill="#FFFFFF"/>
  <rect x="560" y="330" width="80" height="120" rx="40" fill="#0A0A0C" opacity="0.74"/>
  <rect x="520" y="640" width="160" height="22" rx="11" fill="#FFFFFF" opacity="0.85"/>
"""


def wellness() -> str:
    petals = "".join(
        f'<ellipse cx="600" cy="430" rx="52" ry="170" fill="#FFFFFF" '
        f'opacity="{0.30 + 0.1 * (i % 3):.2f}" transform="rotate({i * 45} 600 430)"/>'
        for i in range(8)
    )
    return f"""
  <circle cx="600" cy="430" r="250" fill="#FFFFFF" opacity="0.08"/>
  {petals}
  <circle cx="600" cy="430" r="58" fill="#FFFFFF"/>
"""


def film() -> str:
    holes = "".join(
        f'<rect x="{330 + i * 78}" y="{y}" width="40" height="34" rx="8" '
        f'fill="#0A0A0C" opacity="0.74"/>'
        for i in range(7) for y in (268, 584)
    )
    return f"""
  <rect x="300" y="250" width="600" height="400" rx="34" fill="#FFFFFF" opacity="0.92"/>
  <rect x="300" y="250" width="600" height="70" fill="#FFFFFF"/>
  <rect x="300" y="580" width="600" height="70" fill="#FFFFFF"/>
  <rect x="350" y="340" width="500" height="220" rx="16" fill="#0A0A0C" opacity="0.74"/>
  {holes}
  <polygon points="565,390 700,450 565,510" fill="#FFFFFF" opacity="0.96"/>
"""


def sports() -> str:
    arcs = "".join(
        f'<path d="M{300 - i * 40} {660} A {300 + i * 40} {300 + i * 40} 0 0 1 {900 + i * 40} {660}" '
        f'fill="none" stroke="#FFFFFF" stroke-width="7" opacity="{0.22 - i * 0.06:.2f}"/>'
        for i in range(3)
    )
    seams = "".join(
        f'<line x1="600" y1="430" x2="{600 + 112 * dx}" y2="{430 + 112 * dy}" '
        f'stroke="#0A0A0C" stroke-width="9" opacity="0.62" stroke-linecap="round"/>'
        for dx, dy in ((0, -1), (0.95, 0.31), (0.59, 0.81), (-0.59, 0.81), (-0.95, 0.31))
    )
    return f"""
  {arcs}
  <circle cx="600" cy="430" r="130" fill="#FFFFFF"/>
  {seams}
  <circle cx="600" cy="430" r="26" fill="#0A0A0C" opacity="0.74"/>
"""


def food() -> str:
    return """
  <circle cx="600" cy="430" r="200" fill="#FFFFFF" opacity="0.14"/>
  <circle cx="600" cy="430" r="150" fill="#FFFFFF" opacity="0.92"/>
  <circle cx="600" cy="430" r="96" fill="#0A0A0C" opacity="0.74"/>
  <rect x="300" y="280" width="24" height="300" rx="12" fill="#FFFFFF" opacity="0.90"/>
  <rect x="286" y="280" width="12" height="110" rx="6" fill="#FFFFFF" opacity="0.90"/>
  <rect x="326" y="280" width="12" height="110" rx="6" fill="#FFFFFF" opacity="0.90"/>
  <rect x="876" y="280" width="24" height="300" rx="12" fill="#FFFFFF" opacity="0.90"/>
  <ellipse cx="888" cy="330" rx="34" ry="62" fill="#FFFFFF" opacity="0.90"/>
"""


def workshop() -> str:
    teeth = "".join(
        f'<rect x="585" y="212" width="30" height="62" rx="10" fill="#FFFFFF" '
        f'opacity="0.88" transform="rotate({i * 45} 600 430)"/>'
        for i in range(8)
    )
    return f"""
  <circle cx="600" cy="430" r="215" fill="#FFFFFF" opacity="0.10"/>
  {teeth}
  <circle cx="600" cy="430" r="150" fill="#FFFFFF" opacity="0.92"/>
  <circle cx="600" cy="430" r="72" fill="#0A0A0C" opacity="0.74"/>
  <rect x="770" y="520" width="150" height="34" rx="17" fill="#FFFFFF"
        opacity="0.85" transform="rotate(38 845 537)"/>
"""


def classical() -> str:
    strings = "".join(
        f'<line x1="{560 + i * 27}" y1="300" x2="{560 + i * 27}" y2="600" '
        f'stroke="#0A0A0C" stroke-width="5" opacity="0.62"/>'
        for i in range(4)
    )
    arcs = "".join(
        f'<path d="M360 {640 - i * 30} A 240 {200 + i * 30} 0 0 1 840 {640 - i * 30}" '
        f'fill="none" stroke="#FFFFFF" stroke-width="6" opacity="{0.20 - i * 0.05:.2f}"/>'
        for i in range(3)
    )
    return f"""
  {arcs}
  <path d="M600 250 C700 250 740 360 700 470 C670 560 640 600 600 640
           C560 600 530 560 500 470 C460 360 500 250 600 250 Z"
        fill="#FFFFFF" opacity="0.94"/>
  {strings}
  <circle cx="600" cy="250" r="34" fill="#FFFFFF"/>
  <circle cx="600" cy="250" r="14" fill="#0A0A0C" opacity="0.74"/>
"""


GLYPHS = {
    "tech": tech, "music": music, "art": art, "business": business,
    "comedy": comedy, "wellness": wellness, "film": film, "sports": sports,
    "food": food, "workshop": workshop, "classical": classical,
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = Path("/tmp/eventpass-art")
    tmp.mkdir(exist_ok=True)

    for key, glyph in GLYPHS.items():
        ink, paper = PALETTE[key]

        # The glyphs are authored in white-on-black for legibility while
        # drawing; here they are re-inked. White becomes the category's
        # ink, near-black becomes the paper showing through - exactly how
        # a two-colour print works.
        art = glyph().replace("#FFFFFF", ink).replace("#0A0A0C", paper)

        # Misregistration: a second pass of the same plate, nudged a few
        # pixels and knocked back. Real screen prints never align
        # perfectly, and that imperfection is what reads as "printed"
        # rather than "rendered".
        offset = (
            f'<g transform="translate(7,-6)" opacity="0.38">{art}</g>'
        )

        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
            f'viewBox="0 0 {W} {H}">{frame(key)}{offset}{art}</svg>'
        )
        svg_path = tmp / f"{key}.svg"
        svg_path.write_text(svg)
        png_path = OUT / f"{key}.png"
        subprocess.run(
            ["rsvg-convert", "-w", "800", "-h", "600", "-o", str(png_path), str(svg_path)],
            check=True,
        )
        print(f"  {key:10s} -> {png_path.name} ({png_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
