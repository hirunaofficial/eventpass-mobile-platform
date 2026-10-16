#!/usr/bin/env python3
"""
Generates EventPass's app icon set.

Same approach and provenance as generate_category_art.py: everything is
drawn from geometric primitives in this file, nothing traced or
downloaded, and the whole set can be regenerated from source.

The previous icon was a white ticket on a violet gradient. That matched
the old palette, which was replaced precisely because a purple/blue
gradient is the signature look of generated design. This one follows
"Night Press": warm black paper, a single acid ink, flat colour, a
halftone screen and printer's registration marks - the same visual
language as the in-app category artwork, so the icon and the app read
as one family.

The subject is unchanged: a ticket stub with a perforation line and a
QR block, which is what the app actually does.

Outputs (all 1024 except favicon):
  icon.png                     iOS / general
  splash-icon.png              launch screen (glyph only, no frame)
  android-icon-background.png  adaptive background layer
  android-icon-foreground.png  adaptive foreground, inside the safe zone
  android-icon-monochrome.png  themed-icon silhouette
  favicon.png                  48px web

Usage:  python3 tools/generate_app_icon.py
Requires rsvg-convert (brew install librsvg).
"""

import subprocess
from pathlib import Path

S = 1024
OUT = Path(__file__).resolve().parent.parent / "app/assets"

PAPER = "#141210"   # warm black, matches --background
INK = "#E8FF52"     # acid, matches --primary


def halftone(opacity: float = 0.30, step: int = 46, max_r: float = 10.0) -> str:
    """Dot screen with a diagonal falloff - tone built from solid dots,
    which is how a two-colour print renders a gradient."""
    dots = []
    rows = cols = S // step + 1
    for r in range(rows):
        for c in range(cols):
            t = (c / cols) * 0.55 + (r / rows) * 0.45
            rad = round(max(0.0, max_r * (1.0 - t)), 2)
            if rad < 0.5:
                continue
            cx = 18 + c * step + (step // 2 if r % 2 else 0)
            cy = 18 + r * step
            dots.append(f'<circle cx="{cx}" cy="{cy}" r="{rad}" fill="{INK}"/>')
    return f'<g opacity="{opacity}">{"".join(dots)}</g>'


def ticket(ink: str, scale: float = 1.0, cx: float = S / 2, cy: float = S / 2) -> str:
    """The ticket stub: rounded body, bitten edges, perforation dots and
    a QR block. Drawn around (cx, cy) so it can be re-placed per output."""
    w, h = 620 * scale, 400 * scale
    x, y = cx - w / 2, cy - h / 2
    r = 44 * scale
    bite = 46 * scale
    perf_x = x + w * 0.46

    perfs = "".join(
        f'<circle cx="{perf_x}" cy="{y + h * (0.13 + i * 0.123)}" r="{11 * scale}" fill="{PAPER}"/>'
        for i in range(7)
    )

    # QR block: 3x3 with the centre knocked out, reading as a code
    # without pretending to be a scannable one.
    qr_size = 52 * scale
    qr_gap = 20 * scale
    qr_x = x + w * 0.60
    qr_y = cy - (qr_size * 1.5 + qr_gap)
    cells = []
    for row in range(3):
        for col in range(3):
            if row == 1 and col == 1:
                continue
            cells.append(
                f'<rect x="{qr_x + col * (qr_size + qr_gap)}" '
                f'y="{qr_y + row * (qr_size + qr_gap)}" '
                f'width="{qr_size}" height="{qr_size}" rx="{10 * scale}" fill="{PAPER}"/>'
            )

    # Two text rules on the stub half, suggesting event details.
    rules = (
        f'<rect x="{x + 52 * scale}" y="{cy - 44 * scale}" width="{168 * scale}" '
        f'height="{26 * scale}" rx="{13 * scale}" fill="{PAPER}" opacity="0.55"/>'
        f'<rect x="{x + 52 * scale}" y="{cy + 4 * scale}" width="{112 * scale}" '
        f'height="{26 * scale}" rx="{13 * scale}" fill="{PAPER}" opacity="0.35"/>'
    )

    return f"""
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{ink}"/>
  <circle cx="{x}" cy="{cy}" r="{bite}" fill="{PAPER}"/>
  <circle cx="{x + w}" cy="{cy}" r="{bite}" fill="{PAPER}"/>
  {rules}{perfs}{"".join(cells)}
"""


def registration() -> str:
    """Printer's crosshairs, trimmed by the frame."""
    return f"""
  <g stroke="{INK}" stroke-width="5" opacity="0.45">
    <line x1="64" y1="64" x2="64" y2="124"/><line x1="34" y1="94" x2="94" y2="94"/>
    <line x1="{S-64}" y1="{S-64}" x2="{S-64}" y2="{S-124}"/>
    <line x1="{S-34}" y1="{S-94}" x2="{S-94}" y2="{S-94}"/>
  </g>"""


def svg(body: str, size: int = S, bg: str | None = PAPER) -> str:
    ground = f'<rect width="{size}" height="{size}" fill="{bg}"/>' if bg else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        f'viewBox="0 0 {size} {size}">{ground}{body}</svg>'
    )


def render(name: str, markup: str, width: int = S) -> None:
    tmp = Path("/tmp/eventpass-icon"); tmp.mkdir(exist_ok=True)
    src = tmp / f"{name}.svg"; src.write_text(markup)
    dst = OUT / f"{name}.png"
    subprocess.run(
        ["rsvg-convert", "-w", str(width), "-h", str(width), "-o", str(dst), str(src)],
        check=True,
    )
    print(f"  {name + '.png':32s} {dst.stat().st_size // 1024:>4} KB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    full = halftone() + registration() + ticket(INK)
    render("icon", svg(full))

    # Splash: glyph only on the launch background, no registration marks
    # competing with it at small display size.
    render("splash-icon", svg(ticket(INK, scale=1.12), bg=PAPER))

    # Android adaptive: the system masks and scales these, so the
    # foreground sits inside the ~66% safe zone and the background is
    # plain paper plus texture.
    render("android-icon-background", svg(halftone(0.22)))
    render("android-icon-foreground", svg(ticket(INK, scale=0.70), bg=None))

    # Themed icon: a flat silhouette the system recolours itself.
    render("android-icon-monochrome", svg(ticket("#FFFFFF", scale=0.70), bg=None))

    render("favicon", svg(ticket(INK, scale=1.35)), width=48)


if __name__ == "__main__":
    main()
