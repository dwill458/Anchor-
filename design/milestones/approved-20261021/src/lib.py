"""Anchor milestone SVG toolkit: geometry helpers, palette, renderer.

Design-only. Produces standalone SVG masters (256x256) with reveal-ready layer groups.
No filters, no clipPath, no CSS, no SMIL: only g / path / circle / line / rect / polygon,
linear+radial gradients. Safe for react-native-svg.
"""
import math

CX = CY = 128
VB = 256

# --- stroke hierarchy (viewBox units) -------------------------------------
HL = 1.25   # hairline engraving
FN = 2.5    # fine line
PR = 4.5    # primary line
HV = 6.5    # heavy / rails

LAYERS = ["structure", "emblem", "engraving", "highlight", "accent"]

PAL = {
    "earned": {
        "ink": "#13222C", "inkSoft": "#3A4A55", "gold": "#C9A24A", "goldHi": "#EFC87D",
        "goldDeep": "#A07C3E", "plate": "#FBF6E8", "white": "#FFFFFF", "hill": "#13222C",
    },
    "locked": {
        "ink": "#8C867A", "inkSoft": "#A8A295", "gold": "#B3AB99", "goldHi": "#C6BFAE",
        "goldDeep": "#A19A8B", "plate": "#EDE9DE", "white": "#FFFFFF", "hill": "#E4DFD3",
    },
}
HI_COL = "#FFFFFF"      # locked emboss highlight
LO_COL = "#B7B0A0"      # locked emboss shadow


def f(x):
    s = f"{x:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def P(r, deg, cx=CX, cy=CY):
    """Polar point. 0 deg = up, clockwise."""
    a = math.radians(deg)
    return (cx + r * math.sin(a), cy - r * math.cos(a))


def arc_d(r, a0, a1, cx=CX, cy=CY):
    x0, y0 = P(r, a0, cx, cy)
    x1, y1 = P(r, a1, cx, cy)
    large = 1 if ((a1 - a0) % 360) > 180 else 0
    return f"M{f(x0)} {f(y0)}A{f(r)} {f(r)} 0 {large} 1 {f(x1)} {f(y1)}"


def poly_d(pts, close=True):
    d = "M" + "L".join(f"{f(x)} {f(y)}" for x, y in pts)
    return d + ("Z" if close else "")


def catmull_seg(p0, p1, p2, p3, t=1.0):
    c1 = (p1[0] + (p2[0] - p0[0]) / 6 * t, p1[1] + (p2[1] - p0[1]) / 6 * t)
    c2 = (p2[0] - (p3[0] - p1[0]) / 6 * t, p2[1] - (p3[1] - p1[1]) / 6 * t)
    return c1, c2


def catmull_open(pts, i):
    """Path d for segment pts[i] -> pts[i+1] using neighbours for tangents."""
    p0 = pts[max(i - 1, 0)]
    p1, p2 = pts[i], pts[i + 1]
    p3 = pts[min(i + 2, len(pts) - 1)]
    c1, c2 = catmull_seg(p0, p1, p2, p3)
    return f"M{f(p1[0])} {f(p1[1])}C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}"


def catmull_closed(pts):
    n = len(pts)
    d = f"M{f(pts[0][0])} {f(pts[0][1])}"
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1, c2 = catmull_seg(p0, p1, p2, p3)
        d += f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}"
    return d + "Z"


def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1])


def bez_x_at_y(p0, p1, p2, p3, y):
    best, bx = 1e9, p0[0]
    for i in range(0, 2001):
        x, yy = bez(p0, p1, p2, p3, i / 2000)
        if abs(yy - y) < best:
            best, bx = abs(yy - y), x
    return bx


# --- shape model ------------------------------------------------------------
class S:
    """A drawable. tag in circle|path|line|rect|g|orb. stroke/fill are palette tokens."""

    def __init__(self, tag, a=None, stroke=None, fill=None, sw=None, layer="emblem", sid=None,
                 op=None, dash=None, kids=None, cap="round", join="round", fop=None):
        self.tag, self.a, self.stroke, self.fill, self.sw = tag, a or {}, stroke, fill, sw
        self.layer, self.sid, self.op, self.dash = layer, sid, op, dash
        self.kids, self.cap, self.join, self.fop = kids or [], cap, join, fop


def circle(cx, cy, r, **k):
    return S("circle", {"cx": cx, "cy": cy, "r": r}, **k)


def line(p, q, **k):
    return S("line", {"x1": p[0], "y1": p[1], "x2": q[0], "y2": q[1]}, **k)


def path(d, **k):
    return S("path", {"d": d}, **k)


def rect(x, y, w, h, rx=0, **k):
    a = {"x": x, "y": y, "width": w, "height": h}
    if rx:
        a["rx"] = rx
    return S("rect", a, **k)


def orb(cx, cy, r, **k):
    k.setdefault("layer", "accent")
    k.setdefault("sid", "orb")
    return S("orb", {"cx": cx, "cy": cy, "r": r}, **k)


def group(kids, **k):
    return S("g", {}, kids=kids, **k)


def blade(a, r0, r1, rm, hw, layer="emblem", sid=None, left="ink", right="inkSoft"):
    """Faceted lozenge: two triangles (engraved fold down the middle)."""
    i, l, o, r = P(r0, a), P(rm, a - hw), P(r1, a), P(rm, a + hw)
    t1 = path(poly_d([i, l, o]), fill=left, stroke=left, sw=0.6, layer=layer)
    t2 = path(poly_d([i, o, r]), fill=right, stroke=right, sw=0.6, layer=layer)
    return group([t1, t2], layer=layer, sid=sid)


# --- rendering ---------------------------------------------------------------
def _col(tok, mode, variant):
    if tok is None or tok == "none":
        return "none"
    if variant == "hi":
        return HI_COL
    if variant == "lo":
        return LO_COL
    if tok in ("goldTint", "metal"):
        tok = "gold"
    return PAL[mode][tok]


def emit(sh, slug, mode, variant="main", ind=2):
    pad = "  " * ind
    ident = ""
    if sh.sid and variant == "main":
        ident = f' id="{slug}__{sh.layer}-{sh.sid}"'
    if sh.tag == "orb":
        cx, cy, r = sh.a["cx"], sh.a["cy"], sh.a["r"]
        if variant == "main":
            grad = f"url(#{slug}-orb)" if mode == "earned" else f"url(#{slug}-orbS)"
            rim = PAL[mode]["goldDeep"] if mode == "earned" else "#8F897C"
            out = (f'{pad}<g{ident}>\n{pad}  <circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{grad}" '
                   f'stroke="{rim}" stroke-width="0.9"/>\n'
                   f'{pad}  <circle cx="{f(cx - r * .32)}" cy="{f(cy - r * .36)}" r="{f(r * .26)}" fill="#FFFFFF" '
                   f'opacity="{0.6 if mode == "earned" else 0.5}"/>\n{pad}</g>\n')
            return out
        c = _col("gold", mode, variant)
        return f'{pad}<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{c}"/>\n'
    attrs = "".join(f' {k}="{f(v) if isinstance(v, (int, float)) else v}"' for k, v in sh.a.items())
    if sh.tag == "g":
        inner = "".join(emit(k, slug, mode, variant, ind + 1) for k in sh.kids)
        return f'{pad}<g{ident}>\n{inner}{pad}</g>\n'
    fill = _col(sh.fill, mode, variant)
    if sh.fill == "metal":
        fill = f"url(#{slug}-metal)" if (mode == "earned" and variant == "main") else _col("gold", mode, variant)
    stroke = _col(sh.stroke, mode, variant)
    s = f'{pad}<{sh.tag}{ident}{attrs} fill="{fill}"'
    if sh.fill == "goldTint":
        s = f'{pad}<{sh.tag}{ident}{attrs} fill="{_col("gold", mode, variant)}" fill-opacity="0.22"'
    if stroke != "none":
        s += f' stroke="{stroke}" stroke-width="{f(sh.sw or FN)}" stroke-linecap="{sh.cap}" stroke-linejoin="{sh.join}"'
        if sh.dash:
            s += f' stroke-dasharray="{sh.dash}"'
    if sh.op is not None:
        s += f' opacity="{sh.op}"'
    return s + "/>\n"


def defs(slug, mode):
    if mode == "earned":
        return f'''  <defs>
    <radialGradient id="{slug}-orb" cx="38%" cy="32%" r="78%">
      <stop offset="0" stop-color="#F8E2A8"/><stop offset="0.38" stop-color="#DDB35F"/>
      <stop offset="0.78" stop-color="#B08A46"/><stop offset="1" stop-color="#7E5E28"/>
    </radialGradient>
    <radialGradient id="{slug}-plate" cx="36%" cy="30%" r="85%">
      <stop offset="0" stop-color="#FFFBF0"/><stop offset="0.6" stop-color="#F7F0DE"/><stop offset="1" stop-color="#EBE3CF"/>
    </radialGradient>
    <linearGradient id="{slug}-metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F2D08A"/><stop offset="0.5" stop-color="#D9B263"/><stop offset="1" stop-color="#A98245"/>
    </linearGradient>
  </defs>
'''
    return f'''  <defs>
    <radialGradient id="{slug}-orbS" cx="38%" cy="32%" r="78%">
      <stop offset="0" stop-color="#F6F3EC"/><stop offset="0.5" stop-color="#CFC8B9"/><stop offset="1" stop-color="#9F988A"/>
    </radialGradient>
    <radialGradient id="{slug}-plateS" cx="50%" cy="42%" r="62%">
      <stop offset="0" stop-color="#F4F1E8"/><stop offset="1" stop-color="#E6E1D5"/>
    </radialGradient>
  </defs>
'''


def plate(slug, mode):
    """Medal plate matched to the existing app masters: cream disc, soft bevel, two fine gold rings (r=108.6, r=101)."""
    if mode == "earned":
        return (f'  <g id="{slug}__plate">\n'
                f'    <circle cx="128" cy="128" r="120" fill="url(#{slug}-plate)"/>\n'
                f'    <circle cx="128" cy="128" r="119.2" fill="none" stroke="#CDBE96" stroke-width="1"/>\n'
                f'    <circle cx="128" cy="128" r="117.4" fill="none" stroke="#FFF6DC" stroke-width="1.6" opacity="0.9"/>\n'
                f'    <circle cx="128" cy="128" r="108.6" fill="none" stroke="#B08A50" stroke-width="1.7"/>\n'
                f'    <circle cx="128" cy="128" r="107.2" fill="none" stroke="#F0DFB4" stroke-width="0.7"/>\n'
                f'    <circle cx="128" cy="128" r="101" fill="none" stroke="#B39561" stroke-width="1.2"/>\n'
                f'    <circle cx="128" cy="128" r="99.9" fill="none" stroke="#FEEED2" stroke-width="0.6"/>\n'
                f'  </g>\n')
    return (f'  <g id="{slug}__plate">\n'
            f'    <circle cx="128" cy="128" r="120" fill="url(#{slug}-plateS)"/>\n'
            f'    <circle cx="128" cy="128" r="119.2" fill="none" stroke="#CFC8B8" stroke-width="1"/>\n'
            f'    <circle cx="128" cy="128" r="117.4" fill="none" stroke="#FFFFFF" stroke-width="1.6" opacity="0.9"/>\n'
            f'    <circle cx="128" cy="128" r="108.6" fill="none" stroke="#B8B1A3" stroke-width="1.7"/>\n'
            f'    <circle cx="128" cy="128" r="107.2" fill="none" stroke="#FFFFFF" stroke-width="0.8" opacity="0.9"/>\n'
            f'    <circle cx="128" cy="128" r="101" fill="none" stroke="#C0BAAC" stroke-width="1.1"/>\n'
            f'    <circle cx="128" cy="128" r="99.9" fill="none" stroke="#FFFFFF" stroke-width="0.6" opacity="0.9"/>\n'
            f'  </g>\n')


def render_svg(emb, mode):
    slug = emb["slug"]
    label = f'{emb["name"]} ({emb["category"]}) {"earned" if mode == "earned" else "locked"}'
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" id="{slug}" viewBox="0 0 256 256" width="256" height="256" '
           f'role="img" aria-label="{label}">\n',
           f'  <title>{label}</title>\n',
           f'  <desc>Anchor milestone emblem. Provisional design slug: {slug}. Layers: plate, structure, emblem, engraving, highlight, accent.</desc>\n',
           defs(slug, mode), plate(slug, mode)]
    sc = emb.get("scale", 1)
    if sc != 1:
        out.append(f'  <g id="{slug}__art" transform="translate(128 128) scale({sc}) translate(-128 -128)">\n')
    for layer in LAYERS:
        shapes = [s for s in emb["shapes"] if s.layer == layer]
        if mode == "locked" and layer == "highlight":
            out.append(f'  <g id="{slug}__{layer}"/>\n')
            continue
        out.append(f'  <g id="{slug}__{layer}">\n')
        if mode == "locked":
            out.append('    <g transform="translate(-1 -1)" opacity="0.9">\n' +
                       "".join(emit(s, slug, mode, "hi", 3) for s in shapes) + '    </g>\n')
            out.append('    <g transform="translate(0.9 0.9)" opacity="0.55">\n' +
                       "".join(emit(s, slug, mode, "lo", 3) for s in shapes) + '    </g>\n')
        out.append("".join(emit(s, slug, mode, "main", 2 if mode == "earned" else 2) for s in shapes))
        out.append("  </g>\n")
    if sc != 1:
        out.append("  </g>\n")
    out.append("</svg>\n")
    return "".join(out)
