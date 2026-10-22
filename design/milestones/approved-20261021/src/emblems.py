"""The 16 new Anchor milestone emblems. Each returns a dict with metadata + shapes."""
import math
from lib import *


def meta(slug, name, cat, req, family, shapes, note=""):
    return dict(slug=slug, name=name, category=cat, req=req, family=family, shapes=shapes, note=note)


# ============================ STRENGTH ======================================
def strength_building():
    s = []
    s.append(circle(CX, CY, 66, stroke="inkSoft", sw=HL, dash="1.5 5", layer="structure", sid="ring-ghost"))
    for i, a in enumerate((0, 90, 180, 270)):
        s.append(line(P(60, a), P(74, a), stroke="ink", sw=FN, layer="structure", sid=f"tick-{i+1:02d}"))
    s.append(circle(CX, CY, 40, stroke="ink", sw=PR, layer="emblem", sid="ring-main"))
    s.append(circle(CX, CY, 24, stroke="ink", sw=FN, layer="emblem", sid="ring-inner"))
    for i, a in enumerate((45, 135, 225, 315)):
        s.append(line(P(27, a), P(37, a), stroke="ink", sw=HL, layer="engraving", sid=f"spoke-{i+1:02d}"))
    s.append(circle(CX, CY, 50, stroke="goldDeep", sw=HL, layer="engraving", sid="ring-fine", op=0.8))
    s.append(path(arc_d(40, -40, 50), stroke="gold", sw=FN, layer="highlight", sid="arc-growth"))
    s.append(orb(CX, CY, 11))
    return meta("strength_building", "Building", "Strength", "First Anchor", "strength", s)


def strength_established():
    h = 49.5
    s = []
    s.append(circle(CX, CY, 70, stroke="ink", sw=FN, layer="structure", sid="ring-outer"))
    s.append(rect(CX - h, CY - h, 2 * h, 2 * h, rx=3, stroke="ink", sw=PR, layer="emblem", sid="square"))
    s.append(circle(CX, CY, h, stroke="ink", sw=FN, layer="emblem", sid="ring-inscribed"))
    s.append(path(poly_d([P(h, a) for a in (0, 90, 180, 270)]), stroke="ink", sw=HL, layer="engraving", sid="diamond"))
    s.append(circle(CX, CY, 26, stroke="ink", sw=FN, layer="engraving", sid="ring-core"))
    for i, a in enumerate((45, 135, 225, 315)):
        s.append(path(arc_d(70, a - 14, a + 14), stroke="gold", sw=FN, layer="highlight", sid=f"arc-{i+1:02d}"))
        x, y = P(70, a)
        s.append(circle(x, y, 4, fill="gold", stroke="goldDeep", sw=0.8, layer="accent", sid=f"node-{i+1:02d}"))
    s.append(orb(CX, CY, 11))
    return meta("strength_established", "Established", "Strength", "10 Strength", "strength", s)


def strength_integrated():
    s = []
    s.append(circle(CX, CY, 76, stroke="ink", sw=FN, layer="structure", sid="ring-outer"))
    for k in range(12):
        s.append(line(P(66, k * 30), P(72, k * 30), stroke="goldDeep", sw=HL, layer="structure", sid=f"tick-{k+1:02d}"))
    cs = [P(26, a) for a in (0, 120, 240)]
    for i, (x, y) in enumerate(cs):
        s.append(circle(x, y, 36, stroke="ink", sw=PR, layer="emblem", sid=f"circle-{i+1:02d}"))
    s.append(circle(CX, CY, 18, stroke="ink", sw=FN, layer="engraving", sid="ring-core"))
    for i, a in enumerate((60, 180, 300)):
        s.append(path(arc_d(76, a - 22, a + 22), stroke="gold", sw=FN, layer="highlight", sid=f"arc-{i+1:02d}"))
    s.append(orb(CX, CY, 10))
    return meta("strength_integrated", "Integrated", "Strength", "30 Strength", "strength", s)


def strength_reinforced():
    s = []
    s.append(circle(CX, CY, 80, stroke="inkSoft", sw=HL, layer="structure", sid="ring-fine"))
    s.append(circle(CX, CY, 75, stroke="ink", sw=FN, layer="structure", sid="ring-outer"))
    ro, ri = 62, 30
    s.append(path(poly_d([P(ro, 60 * k) for k in range(6)]), stroke="ink", sw=PR, layer="emblem", sid="hex-outer"))
    s.append(path(poly_d([P(ri, 30 + 60 * k) for k in range(6)]), stroke="ink", sw=PR, layer="emblem", sid="hex-inner"))
    n = 0
    for k in range(6):
        for d in (-30, 30):
            n += 1
            s.append(line(P(ro, 60 * k), P(ri, 60 * k + d), stroke="ink", sw=FN, layer="engraving", sid=f"strut-{n:02d}"))
    s.append(circle(CX, CY, ro, stroke="goldDeep", sw=HL, layer="engraving", sid="ring-circum", op=0.9))
    for i in range(6):
        s.append(path(arc_d(75, 60 * i - 14, 60 * i + 14), stroke="gold", sw=FN, layer="highlight", sid=f"arc-{i+1:02d}"))
        x, y = P(ro, 60 * i)
        s.append(circle(x, y, 5.5, fill="gold", stroke="ink", sw=1.4, layer="accent", sid=f"node-{i+1:02d}"))
    s.append(circle(CX, CY, 17, stroke="ink", sw=FN, fill="plate", layer="accent", sid="ring-core"))
    s.append(orb(CX, CY, 11))
    return meta("strength_reinforced", "Reinforced", "Strength", "70 Strength", "strength", s)


def strength_full_strength():
    s = []
    s.append(circle(CX, CY, 92, stroke="goldDeep", sw=HL, layer="structure", sid="ring-halo"))
    for k in range(24):
        s.append(line(P(86, k * 15), P(92 if k % 2 else 95, k * 15), stroke="goldDeep", sw=1.4, layer="structure", sid=f"tick-{k+1:02d}", cap="butt"))
    for i, r in enumerate((66, 50, 35)):
        s.append(circle(CX, CY, r, stroke="ink", sw=PR if i != 1 else PR + .5, layer="emblem", sid=f"ring-{i+1}"))
    for i, a in enumerate((0, 90, 180, 270)):
        s.append(line(P(23, a), P(78, a), stroke="goldDeep", sw=HL, layer="engraving", sid=f"axis-{i+1}"))
    s.append(circle(CX, CY, 42.5, stroke="inkSoft", sw=HL, layer="engraving", sid="ring-fine-a", dash="1.5 4"))
    s.append(circle(CX, CY, 58, stroke="inkSoft", sw=HL, layer="engraving", sid="ring-fine-b", dash="1.5 4"))
    for i, (r, a) in enumerate(((66, 45), (66, 225), (50, 135), (50, 315), (35, 0), (35, 180))):
        s.append(path(arc_d(r, a - 22, a + 22), stroke="gold", sw=FN, layer="highlight", sid=f"arc-{i+1:02d}"))
    s.append(circle(CX, CY, 92, stroke="gold", sw=FN, layer="highlight", sid="ring-crown", dash="40 12"))
    for i, a in enumerate((0, 90, 180, 270)):
        x, y = P(78, a)
        s.append(orb(x, y, 7.5, sid=f"sat-{i+1}"))
    s.append(orb(CX, CY, 21))
    return meta("strength_full_strength", "Full Strength", "Strength", "100 Strength", "strength", s,
                note="Vector candidate for the 100 Strength milestone; the original master was not available.")


# ============================ COMMITMENT ====================================
def commitment_ten_practices():
    s = []
    s.append(circle(CX, CY, 94, stroke="goldDeep", sw=HL, layer="structure", sid="ring-outer", op=0.85))
    s.append(circle(CX, CY, 27, stroke="ink", sw=PR, layer="structure", sid="ring-core"))
    for k in range(10):
        s.append(blade(36 * k, 34, 84, 56, 5.8, sid=f"mark-{k+1:02d}"))
    for k in range(10):
        x, y = P(70, 36 * k + 18)
        s.append(circle(x, y, 1.9, fill="ink", layer="engraving", sid=f"dot-{k+1:02d}"))
    s.append(circle(CX, CY, 44, stroke="goldDeep", sw=HL, layer="engraving", sid="ring-fine", dash="1.5 4"))
    s.append(path(poly_d([P(84, 0), P(74, -3.4), P(74, 3.4)]), fill="gold", stroke="goldDeep", sw=0.8, layer="highlight", sid="tip-gold"))
    for k in range(10):
        x, y = P(80, 36 * k + 18)
        s.append(circle(x, y, 3.2, fill="gold", stroke="goldDeep", sw=0.8, layer="accent", sid=f"bead-{k+1:02d}"))
    s.append(orb(CX, CY, 11))
    return meta("commitment_ten_practices", "Ten Practices", "Commitment", "10 practices", "commitment", s)


def commitment_thirty_practices():
    s = []
    tiers = [(22, 46, 35, 6.4, 0), (48, 70, 59, 5.2, 18), (72, 93, 84, 4.0, 0)]
    n = 0
    for (r0, r1, rm, hw, off) in tiers:
        for k in range(10):
            n += 1
            s.append(blade(36 * k + off, r0, r1, rm, hw, sid=f"mark-{n:02d}"))
    s.append(circle(CX, CY, 47, stroke="goldDeep", sw=HL, layer="structure", sid="ring-a"))
    s.append(circle(CX, CY, 71, stroke="goldDeep", sw=HL, layer="structure", sid="ring-b"))
    s.append(circle(CX, CY, 16, stroke="ink", sw=FN, layer="structure", sid="ring-core"))
    for k in range(10):
        x, y = P(59, 36 * k + 0)
        s.append(circle(x, y, 1.6, fill="plate", layer="engraving", sid=f"dot-{k+1:02d}"))
    for i, (r, a) in enumerate(((47, 0), (71, 18), (47, 180), (71, 198))):
        s.append(path(arc_d(r, a - 10, a + 10), stroke="gold", sw=FN, layer="highlight", sid=f"arc-{i+1:02d}"))
    for i, r in enumerate((47, 71, 94)):
        x, y = P(r, 0)
        s.append(path(poly_d([(x, y - 4.5), (x + 3.4, y), (x, y + 4.5), (x - 3.4, y)]), fill="gold", stroke="goldDeep", sw=0.8, layer="accent", sid=f"gem-{i+1}"))
    s.append(orb(CX, CY, 8))
    return meta("commitment_thirty_practices", "Thirty Practices", "Commitment", "30 practices", "commitment", s)


def commitment_one_hundred_practices():
    s = []
    s.append(circle(CX, CY, 78, stroke="ink", sw=FN, layer="structure", sid="ring-track"))
    for k in range(100):
        a = k * 3.6
        if k % 10 == 0:
            continue
        r0 = 82 if k % 5 == 0 else 85
        s.append(line(P(r0, a), P(94, a), stroke="ink", sw=1.5 if k % 5 == 0 else HL, layer="structure", sid=f"tick-{k+1:03d}", cap="butt"))
    for k in range(10):
        s.append(blade(36 * k, 20, 66, 42, 6.4, sid=f"mark-{k+1:02d}"))
    s.append(circle(CX, CY, 70, stroke="goldDeep", sw=HL, layer="engraving", sid="ring-fine"))
    for k in range(10):
        x, y = P(54, 36 * k + 18)
        s.append(path(poly_d([(x, y - 3.6), (x + 2.6, y), (x, y + 3.6), (x - 2.6, y)]), fill="ink", layer="engraving", sid=f"gem-{k+1:02d}"))
    for k in range(10):
        s.append(line(P(80, 36 * k), P(97, 36 * k), stroke="gold", sw=3, layer="highlight", sid=f"decade-{k+1:02d}", cap="butt"))
    s.append(circle(CX, CY, 17, stroke="gold", sw=FN, fill="plate", layer="accent", sid="ring-core"))
    s.append(orb(CX, CY, 9))
    return meta("commitment_one_hundred_practices", "One Hundred Practices", "Commitment", "100 practices", "commitment", s)


def _hourglass_curves(hw_rail, hw_neck, top, bot, bulge=0.0):
    """Left half-curves of the glass: (upper, lower). Mirror around x=128."""
    xl, xn = 128 - hw_rail, 128 - hw_neck
    upper = ((xl, top), (xl, top + 30), (xn, CY - 20), (xn, CY))
    lower = ((xn, CY), (xn, CY + 20), (xl, bot - 30), (xl, bot))
    return upper, lower


def _glass_outline(upper, lower):
    (a0, a1, a2, a3), (b0, b1, b2, b3) = upper, lower
    m = lambda p: (256 - p[0], p[1])
    return ("M{} {}C{} {} {} {} {} {}C{} {} {} {} {} {}L{} {}C{} {} {} {} {} {}C{} {} {} {} {} {}Z".format(
        *[f(v) for v in (a0[0], a0[1], a1[0], a1[1], a2[0], a2[1], a3[0], a3[1],
                         b1[0], b1[1], b2[0], b2[1], b3[0], b3[1],
                         m(b3)[0], m(b3)[1],
                         m(b2)[0], m(b2)[1], m(b1)[0], m(b1)[1], m(b0)[0], m(b0)[1],
                         m(a2)[0], m(a2)[1], m(a1)[0], m(a1)[1], m(a0)[0], m(a0)[1])]))


def _sand_lines(curve, y_from, y_to, step, inset, **k):
    out = []
    y = y_from
    i = 0
    while (y <= y_to if y_to >= y_from else y >= y_to):
        xl = bez_x_at_y(*curve, y)
        xr = 256 - xl
        i += 1
        out.append(line((xl + inset, y), (xr - inset, y), sid=f"sand-{i:02d}", **k))
        y += step if y_to >= y_from else -step
    return out


def commitment_100_minutes():
    top, bot = 70, 186
    upper, lower = _hourglass_curves(34, 6, top, bot)
    s = []
    for side, rng in ((1, range(58, 123, 4)), (-1, range(58, 123, 4))):
        pass
    # minute scale arcs flanking the glass
    n = 0
    for base, rng in ((90, range(-52, 53, 4)), (270, range(-52, 53, 4))):
        for j, d in enumerate(rng):
            n += 1
            major = (j % 5 == 0)
            a = base + d
            s.append(line(P(84 if major else 87, a), P(94, a), stroke="ink", sw=1.6 if major else HL, layer="structure", sid=f"tick-{n:03d}", cap="butt"))
    s.append(path(_glass_outline(upper, lower), stroke="ink", sw=PR, layer="emblem", sid="glass"))
    s.append(rect(86, 58, 84, 12, rx=3, fill="ink", stroke="ink", sw=1, layer="emblem", sid="rail-top"))
    s.append(rect(86, 186, 84, 12, rx=3, fill="ink", stroke="ink", sw=1, layer="emblem", sid="rail-bottom"))
    # sand: lower bulb hatch (gold), upper bulb a few lines
    s += _sand_lines(lower and (lower[0], lower[1], lower[2], lower[3]), 182, 160, 4.5, 3.5, stroke="gold", sw=1.6, layer="engraving")
    up = (upper[0], upper[1], upper[2], upper[3])
    for i, yv in enumerate((112, 106)):
        xl = bez_x_at_y(*up, yv)
        s.append(line((xl + 4, yv), (256 - xl - 4, yv), stroke="goldDeep", sw=1.4, layer="engraving", sid=f"sand-up-{i+1}"))
    s.append(path("M128 128V157", stroke="gold", sw=1.8, layer="highlight", sid="thread"))
    for i, a in enumerate((90, 270)):
        for j, d in enumerate((0,)):
            x, y = P(94, a)
            s.append(circle(x, y, 3, fill="gold", stroke="goldDeep", sw=0.8, layer="accent", sid=f"bead-{i+1}"))
    s.append(circle(128, 64, 2.6, fill="gold", stroke="goldDeep", sw=0.8, layer="accent", sid="finial-top"))
    s.append(circle(128, 192, 2.6, fill="gold", stroke="goldDeep", sw=0.8, layer="accent", sid="finial-bottom"))
    return meta("commitment_100_minutes", "100 Minutes", "Commitment", "100 minutes", "commitment", s,
                note="Hourglass vocabulary retained from the mockup for recognition; rebuilt as engraved hatch glass with a minute scale.")


def commitment_500_minutes():
    top, bot = 70, 186
    upper, lower = _hourglass_curves(30, 6, top, bot)
    s = []
    # back half of the armillary ring (behind the glass)
    s.append(path("M44 128A84 17 0 0 1 212 128", stroke="goldDeep", sw=HL, layer="structure", sid="ring-back", dash="2 3"))
    # posts
    for i, x in enumerate((78, 178)):
        s.append(line((x, 66), (x, 190), stroke="ink", sw=PR, layer="structure", sid=f"post-{i+1}"))
    s.append(path(_glass_outline(upper, lower), stroke="ink", sw=PR, layer="emblem", sid="glass"))
    s.append(rect(66, 54, 124, 13, rx=3.5, fill="ink", stroke="ink", sw=1, layer="emblem", sid="rail-top"))
    s.append(rect(66, 189, 124, 13, rx=3.5, fill="ink", stroke="ink", sw=1, layer="emblem", sid="rail-bottom"))
    s.append(line((72, 60.5), (184, 60.5), stroke="goldHi", sw=HL, layer="engraving", sid="rail-sheen-top"))
    s.append(line((72, 195.5), (184, 195.5), stroke="goldHi", sw=HL, layer="engraving", sid="rail-sheen-bottom"))
    s += _sand_lines((lower[0], lower[1], lower[2], lower[3]), 184, 148, 3.6, 3.2, stroke="gold", sw=1.6, layer="engraving")
    up = (upper[0], upper[1], upper[2], upper[3])
    xl = bez_x_at_y(*up, 116)
    s.append(line((xl + 4, 116), (256 - xl - 4, 116), stroke="goldDeep", sw=1.4, layer="engraving", sid="sand-up-1"))
    for i, y in enumerate((100, 140, 172)):
        s.append(line((74, y), (82, y), stroke="gold", sw=FN, layer="highlight", sid=f"band-l-{i+1}", cap="butt"))
        s.append(line((174, y), (182, y), stroke="gold", sw=FN, layer="highlight", sid=f"band-r-{i+1}", cap="butt"))
    s.append(path("M128 128V150", stroke="gold", sw=1.8, layer="highlight", sid="thread"))
    # front half of the ring (in front of the glass)
    s.append(path("M44 128A84 17 0 0 0 212 128", stroke="gold", sw=FN, layer="highlight", sid="ring-front"))
    for i, a in enumerate((-48, -24, 0, 24, 48)):
        x, y = P(80, a)
        s.append(circle(x, y - 12, 4.2, fill="gold", stroke="goldDeep", sw=0.9, layer="accent", sid=f"bead-{i+1}"))
    for i, x in enumerate((78, 178)):
        s.append(circle(x, 62, 3.4, fill="gold", stroke="goldDeep", sw=0.8, layer="accent", sid=f"cap-top-{i+1}"))
        s.append(circle(x, 194, 3.4, fill="gold", stroke="goldDeep", sw=0.8, layer="accent", sid=f"cap-bottom-{i+1}"))
    return meta("commitment_500_minutes", "500 Minutes", "Commitment", "500 minutes", "commitment", s)


# ============================ JOURNEY =======================================
_R0 = [(60, 188), (108, 172), (152, 150), (114, 128), (84, 100), (122, 80), (172, 60)]
ROUTE = [(128 + (x - 128) * 0.86, 134 + (y - 134) * 0.80) for x, y in _R0]


def _contours():
    out = []
    cx, cy = 126, 128
    for i, R in enumerate((18, 34, 50, 66)):
        pts = []
        for j in range(24):
            th = j / 24 * 2 * math.pi
            r = R * (1 + 0.09 * math.sin(3 * th + i * 0.9) + 0.05 * math.sin(5 * th + 1.7 * i))
            pts.append((cx + r * math.cos(th) * 1.05, cy + r * math.sin(th) * 0.92))
        out.append(path(catmull_closed(pts), stroke="goldDeep", sw=HL, layer="structure", sid=f"contour-{i+1}", op=0.75))
    return out


def _journey(slug, name, req, lit_to, pennant_at, mid=False, complete=False):
    s = _contours()
    pts = ROUTE
    # origin
    s.append(circle(*pts[0], 5, fill="plate", stroke="ink", sw=FN, layer="emblem", sid="origin"))
    for i in range(len(pts) - 1):
        lit = (i + 1) <= lit_to
        if lit:
            s.append(path(catmull_open(pts, i), stroke="ink", sw=4, layer="emblem", sid=f"seg-{i+1}"))
        else:
            s.append(path(catmull_open(pts, i), stroke="inkSoft", sw=1.6, dash="2 5", layer="emblem", sid=f"seg-{i+1}"))
    # waypoints 1..5 (nodes), 6 = summit marker
    for i in range(1, 6):
        x, y = pts[i]
        if i <= lit_to:
            s.append(circle(x, y, 8.5, fill="plate", stroke="ink", sw=FN, layer="engraving", sid=f"wp-ring-{i}"))
        else:
            s.append(circle(x, y, 6, fill="plate", stroke="inkSoft", sw=1.8, layer="engraving", sid=f"wp-ring-{i}"))
    sx, sy = pts[6]
    summit_col = "ink" if complete else "inkSoft"
    s.append(circle(sx, sy, 12, stroke=summit_col, sw=FN if complete else 1.6, fill="plate", layer="engraving", sid="summit-ring"))
    s.append(path(f"M{f(sx-6)} {f(sy-6)}L{f(sx+6)} {f(sy+6)}M{f(sx+6)} {f(sy-6)}L{f(sx-6)} {f(sy+6)}",
                  stroke=summit_col, sw=PR if complete else 2, layer="engraving", sid="summit-x"))
    # gold inlay along lit route
    for i in range(lit_to):
        s.append(path(catmull_open(pts, i), stroke="gold", sw=1.3, layer="highlight", sid=f"inlay-{i+1}"))
    if mid:
        x, y = pts[3]
        s.append(circle(x, y, 14, stroke="gold", sw=FN, layer="highlight", sid="mid-ring"))
        s.append(path(f"M{f(x-22)} {f(y)}L{f(x-17)} {f(y)}M{f(x+17)} {f(y)}L{f(x+22)} {f(y)}", stroke="gold", sw=FN, layer="highlight", sid="mid-ticks"))
    if complete:
        for k in range(24):
            s.append(line(P(94, k * 15), P(98 if k % 2 else 101, k * 15), stroke="gold", sw=1.5, layer="structure", sid=f"bezel-{k+1:02d}", cap="butt"))
        x, y = pts[6]
        for i, a in enumerate((0, 90, 180, 270)):
            s.append(line(P(15, a, x, y), P(24, a, x, y), stroke="gold", sw=FN, layer="highlight", sid=f"spark-{i+1}"))
    # lit nodes + pennant
    for i in range(1, min(lit_to, 5) + 1):
        x, y = pts[i]
        s.append(orb(x, y, 5.2, sid=f"wp-{i}"))
    if complete:
        s.append(orb(sx, sy, 5.2, sid="wp-6"))
    px, py = pts[pennant_at]
    if not complete:
        s.append(group([
            line((px, py - 8), (px, py - 34), stroke="ink", sw=FN),
            path(poly_d([(px, py - 34), (px + 17, py - 28), (px, py - 22)]), fill="gold", stroke="ink", sw=1.6),
        ], layer="accent", sid="pennant"))
    else:
        s.append(group([
            line((sx, sy - 12), (sx, sy - 38), stroke="ink", sw=FN),
            path(poly_d([(sx, sy - 38), (sx + 17, sy - 32), (sx, sy - 26)]), fill="gold", stroke="ink", sw=1.6),
        ], layer="accent", sid="pennant"))
    return meta(slug, name, "Journey", req, "journey", s)


def journey_first_waypoint():
    return _journey("journey_first_waypoint", "First Waypoint", "1 waypoint", 1, 1)


def journey_halfway():
    return _journey("journey_halfway", "Halfway", "50% waypoints", 3, 3, mid=True)


def journey_all_waypoints():
    return _journey("journey_all_waypoints", "All Waypoints", "All waypoints", 6, 6, complete=True)


# ============================ VISION ========================================
def vision_picture_complete():
    k = 0.88
    X = lambda v: 128 + (v - 128) * k
    s = []
    s.append(rect(X(51), X(51), 154 * k, 154 * k, rx=11, stroke="goldDeep", sw=HL, layer="structure", sid="frame-outer"))
    s.append(rect(X(58), X(58), 140 * k, 140 * k, rx=8, stroke="ink", sw=PR, layer="structure", sid="frame"))
    sunx, suny = 128, X(100)
    for i in range(12):
        x, y = P(21, i * 30, sunx, suny)
        x2, y2 = P(29, i * 30, sunx, suny)
        s.append(line((x, y), (x2, y2), stroke="gold", sw=1.2, layer="engraving", sid=f"ray-{i+1:02d}"))
    pts = [(60, 150), (86, 128), (108, 144), (138, 116), (170, 142), (196, 124)]
    s.append(path(poly_d([(X(a), X(b)) for a, b in pts], close=False), stroke="ink", sw=FN, layer="emblem", sid="ridge-far"))
    def hill(dy):
        c = [(60, 170), (84, 152), (104, 160), (128, 170), (156, 182), (178, 162), (196, 152)]
        return c
    d = (f"M{f(X(60))} {f(X(196))}V{f(X(170))}C{f(X(84))} {f(X(152))} {f(X(104))} {f(X(160))} {f(X(128))} {f(X(170))}"
         f"C{f(X(156))} {f(X(182))} {f(X(178))} {f(X(162))} {f(X(196))} {f(X(152))}V{f(X(196))}Z")
    s.append(path(d, fill="ink", stroke="ink", sw=1, layer="emblem", sid="hill-near"))
    for i, dy in enumerate((9, 16, 23)):
        dd = (f"M{f(X(61))} {f(X(170+dy))}C{f(X(84))} {f(X(152+dy))} {f(X(104))} {f(X(160+dy))} {f(X(128))} {f(X(170+dy))}"
              f"C{f(X(156))} {f(X(182+dy))} {f(X(178))} {f(X(162+dy))} {f(X(195))} {f(X(154+dy))}")
        s.append(path(dd, stroke="plate", sw=HL, layer="engraving", sid=f"etch-{i+1}", op=0.85))
    t = 140 * k / 3
    for i in range(2):
        v = X(58) + t * (i + 1)
        s.append(line((v, X(60)), (v, X(196)), stroke="plate", sw=3.4, layer="engraving", sid=f"seam-v{i+1}", cap="butt"))
        s.append(line((X(60), v), (X(196), v), stroke="plate", sw=3.4, layer="engraving", sid=f"seam-h{i+1}", cap="butt"))
    spots = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
    for i, (dx, dy) in enumerate(spots):
        R = 84 if not (dx and dy) else 80
        s.append(circle(128 + dx * R * (0.82 if dx and dy else 1) , 128 + dy * R * (0.82 if dx and dy else 1), 3,
                        fill="gold", stroke="goldDeep", sw=0.8, layer="accent", sid=f"cell-{i+1}"))
    s.append(path(f"M{f(X(98))} {f(X(70))}H{f(X(158))}", stroke="gold", sw=FN, layer="highlight", sid="glint"))
    s.append(orb(sunx, suny, 14))
    return meta("vision_picture_complete", "Picture Complete", "Vision", "8 images", "vision", s)


def vision_seen_clearly():
    s = []
    # viewfinder brackets
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        x, y = CX + sx * 62, CY + sy * 62
        s.append(path(f"M{f(x)} {f(y - sy * 22)}V{f(y)}H{f(x - sx * 22)}", stroke="ink", sw=PR, layer="structure", sid=f"bracket-{i+1}"))
    s.append(circle(CX, CY, 56, stroke="goldDeep", sw=HL, layer="structure", sid="ring-guide", dash="1.5 4"))
    s.append(circle(CX, CY, 34, stroke="ink", sw=PR, layer="emblem", sid="ring-focus"))
    s.append(circle(CX, CY, 21, stroke="ink", sw=FN, layer="emblem", sid="ring-inner"))
    for i, a in enumerate((0, 90, 180, 270)):
        s.append(line(P(40, a), P(54, a), stroke="ink", sw=PR, layer="emblem", sid=f"reticle-{i+1}", cap="butt"))
    for i, (dx, op) in enumerate(((-8, .38), (-16, .24), (-24, .13))):
        s.append(circle(CX + dx, CY, 34, stroke="ink", sw=HL, layer="engraving", sid=f"ghost-{i+1}", op=op))
    s.append(path("M70 128H92", stroke="inkSoft", sw=HL, dash="2 3", layer="engraving", sid="horizon-soft"))
    s.append(path("M164 128H186", stroke="ink", sw=1.6, layer="engraving", sid="horizon-sharp"))
    s.append(path(arc_d(34, 18, 110), stroke="gold", sw=FN, layer="highlight", sid="arc-focus"))
    for i, a in enumerate((0, 90, 180, 270)):
        x, y = P(60, a)
        s.append(path(poly_d([(x, y - 3.6), (x + 2.6, y), (x, y + 3.6), (x - 2.6, y)]), fill="gold", stroke="goldDeep", sw=0.7, layer="accent", sid=f"gem-{i+1}"))
    s.append(orb(CX, CY, 12))
    return meta("vision_seen_clearly", "Seen Clearly", "Vision", "1 Visualize", "vision", s)


def _arch(cx, base, w, h):
    r = w / 2
    return f"M{f(cx-r)} {f(base)}V{f(base-h+r)}A{f(r)} {f(r)} 0 0 1 {f(cx+r)} {f(base-h+r)}V{f(base)}"


def vision_familiar_future():
    s = []
    vp = (CX, 172)
    for i, (x, y) in enumerate(((60, 198), (196, 198))):
        s.append(line((x, y), vp, stroke="goldDeep", sw=HL, layer="structure", sid=f"floor-{i+1}", op=0.9))
    s.append(path("M54 172H202", stroke="goldDeep", sw=HL, layer="structure", sid="horizon"))
    s.append(path(_arch(128, 198, 128, 140), stroke="inkSoft", sw=1.8, dash="2 5", layer="emblem", sid="arch-1"))
    s.append(path(_arch(128, 189.4, 88, 96), stroke="inkSoft", sw=FN + .8, layer="emblem", sid="arch-2"))
    s.append(path(_arch(128, 182.2, 54, 58) + "Z", stroke="ink", sw=PR, fill="goldTint", layer="emblem", sid="arch-3"))
    for i, a in enumerate(range(-60, 61, 30)):
        s.append(line(P(18, a, 128, 166), P(28, a, 128, 166), stroke="gold", sw=1.3, layer="engraving", sid=f"ray-{i+1}"))
    s.append(path(_arch(128, 198, 144, 156), stroke="gold", sw=1.3, layer="highlight", sid="arch-halo"))
    s.append(circle(128, 202, 3, fill="gold", stroke="goldDeep", sw=0.8, layer="accent", sid="base-gem"))
    s.append(orb(128, 166, 10))
    return meta("vision_familiar_future", "Familiar Future", "Vision", "10 Visualize", "vision", s)


def vision_living_the_vision():
    s = []
    sx, sy = 128, 138
    for k in range(18):
        a = k * 20 + 10
        s.append(line(P(24, a, sx, sy), P(84 if k % 2 == 0 else 70, a, sx, sy), stroke="gold", sw=1.3, layer="structure", sid=f"ray-{k+1:02d}", op=0.9))
    s.append(path(_arch(128, 186, 92, 116) + "Z", stroke="none", fill="goldTint", sw=0, layer="structure", sid="door-tint"))
    s.append(path(_arch(128, 186, 92, 116), stroke="ink", sw=HV, layer="emblem", sid="arch-main"))
    s.append(path(_arch(128, 186, 76, 98), stroke="ink", sw=1.4, layer="emblem", sid="arch-inner"))
    for i, (y, hw) in enumerate(((176, 30), (167, 22), (158, 15))):
        s.append(line((128 - hw, y), (128 + hw, y), stroke="inkSoft", sw=1.8, layer="engraving", sid=f"tread-in-{i+1}"))
    for i, (y, hw) in enumerate(((191, 48), (200, 56), (209, 64))):
        s.append(line((128 - hw, y), (128 + hw, y), stroke="ink", sw=5.2, layer="emblem", sid=f"step-{i+1}"))
    s.append(path(_arch(128, 186, 100, 124), stroke="gold", sw=1.4, layer="highlight", sid="halo-arch"))
    s.append(orb(sx, sy, 15))
    return meta("vision_living_the_vision", "Living the Vision", "Vision", "30 Visualize", "vision", s)



# ===================== RECONSTRUCTED MASTERS (from app screenshots) ==========
def commitment_first_practice():
    s = []
    s.append(circle(CX, CY, 90, stroke="goldDeep", sw=HL, layer="structure", sid="ring-outer", op=0.8))
    for k in range(8):
        s.append(line(P(84, k * 45 + 22.5), P(90, k * 45 + 22.5), stroke="goldDeep", sw=1.2, layer="structure", sid=f"tick-{k+1:02d}", cap="butt"))
    s.append(circle(CX, CY, 24, stroke="ink", sw=FN, layer="structure", sid="ring-core"))
    n = 0
    for k in range(8):
        a = k * 45
        card = (k % 2 == 0)
        R, rm, hw, r0 = (80, 30, 11, 14) if card else (62, 26, 9.5, 14)
        tip, base = P(R, a), P(r0, a)
        l_, r_ = P(rm, a - hw), P(rm, a + hw)
        n += 1
        if card:
            s.append(path(poly_d([base, l_, tip, r_]), fill="metal", stroke="ink", sw=1.7, layer="emblem", sid=f"mark-{n:02d}"))
        else:
            s.append(path(poly_d([base, l_, tip, r_]), fill="plate", stroke="ink", sw=2.1, layer="emblem", sid=f"mark-{n:02d}"))
        s.append(line(base, tip, stroke="ink", sw=0.9, layer="engraving", sid=f"facet-{n:02d}"))
    for i, a in enumerate((22.5, 112.5, 202.5, 292.5)):
        s.append(path(arc_d(36, a - 12, a + 12), stroke="gold", sw=FN, layer="highlight", sid=f"arc-{i+1:02d}"))
    s.append(orb(CX, CY, 6))
    return meta("commitment_first_practice", "First Practice", "Commitment", "1 practice", "commitment", s,
                note="Vector reconstruction from the in-app screenshot; the original SVG master was not available.")


def vision_first_glimpse():
    s = []
    s.append(circle(CX, CY, 87, stroke="ink", sw=1.4, layer="structure", sid="ring-outer"))
    s.append(circle(CX, CY, 78, stroke="goldDeep", sw=HL, layer="structure", sid="ring-fine", dash="1.5 4"))
    for i, a in enumerate((0, 90, 180, 270)):
        tip = P(70, a)
        va, vb = P(15, a - 45), P(15, a + 45)
        cream = a in (0, 270)
        s.append(path(poly_d([(CX, CY), tip, va]), fill="ink", stroke="ink", sw=1.2, layer="emblem", sid=f"arm-{i+1}a"))
        s.append(path(poly_d([(CX, CY), tip, vb]), fill="plate" if cream else "inkSoft", stroke="ink", sw=1.2, layer="emblem", sid=f"arm-{i+1}b"))
    for i, a in enumerate((0, 90, 180, 270)):
        s.append(line(P(74, a), P(98, a), stroke="goldDeep", sw=1.4, layer="engraving", sid=f"cross-{i+1}"))
    for i, a in enumerate((45, 135, 225, 315)):
        s.append(line(P(24, a), P(52, a), stroke="inkSoft", sw=HL, layer="engraving", sid=f"diag-{i+1}"))
    s.append(circle(CX, CY, 12, stroke="gold", sw=FN, layer="highlight", sid="ring-hub"))
    s.append(orb(CX, CY, 6.5))
    return meta("vision_first_glimpse", "First Glimpse", "Vision", "Create a Vision", "vision", s,
                note="Vector reconstruction from the in-app screenshot; the original SVG master was not available.")


def journey_goal_reached():
    s = []
    hy = 146
    ys = (160, 166, 172, 178, 184, 190, 196, 202, 208)
    for j, y in enumerate(ys):
        hc = (88 ** 2 - (y - 128) ** 2) ** 0.5 - 3
        x0, x1 = 128 - hc, 128 + hc
        w = 6 if j % 2 else -6
        s.append(path(f"M{f(x0)} {y}C{f(x0+hc*0.6)} {y+w} {f(x1-hc*0.6)} {y-w} {f(x1)} {y}", stroke="inkSoft", sw=HL, layer="structure", sid=f"contour-{j+1}"))
    s.append(path(f"M43 152C72 136 112 138 130 154", stroke="ink", sw=PR - 0.5, layer="emblem", sid="hill-1"))
    s.append(path(f"M100 182C128 146 188 128 214 152", stroke="ink", sw=PR - 0.5, layer="emblem", sid="hill-2"))
    road = [(104, 206), (130, 190), (108, 174), (136, 160), (150, 150)]
    for i in range(4):
        s.append(path(catmull_open(road, i), stroke="ink", sw=FN + 1, layer="emblem", sid=f"seg-{i+1}"))
    for i in range(4):
        s.append(path(catmull_open(road, i), stroke="gold", sw=1.3, layer="highlight", sid=f"inlay-{i+1}"))
    s.append(path(arc_d(40, -90, 90, CX, hy), stroke="ink", sw=FN, layer="engraving", sid="sun-outer"))
    s.append(path(arc_d(33.5, -90, 90, CX, hy), stroke="inkSoft", sw=HL, layer="engraving", sid="sun-inner"))
    for k in range(13):
        a = -84 + 14 * k
        s.append(line(P(48, a, CX, hy), P(76 if k % 2 == 0 else 68, a, CX, hy), stroke="gold", sw=FN if k % 2 == 0 else 1.6, layer="highlight", sid=f"ray-{k+1:02d}", cap="round"))
    s.append(orb(150, 150, 5.5, sid="goal"))
    return meta("journey_goal_reached", "Goal Reached", "Journey", "Final waypoint", "journey", s,
                note="Vector reconstruction from the in-app screenshot; the original SVG master was not available.")


ALL = [
    strength_building, strength_established, strength_integrated, strength_reinforced, strength_full_strength,
    commitment_ten_practices, commitment_thirty_practices, commitment_one_hundred_practices,
    commitment_100_minutes, commitment_500_minutes,
    journey_first_waypoint, journey_halfway, journey_all_waypoints,
    commitment_first_practice, journey_goal_reached, vision_first_glimpse,
    vision_picture_complete, vision_seen_clearly, vision_familiar_future, vision_living_the_vision,
]
