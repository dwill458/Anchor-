import WidgetKit
import SwiftUI
import Foundation

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot model — contract lives in src/widgets/widgetTypes.ts and is written
// by src/widgets/widgetDataBridge.ts via the AnchorWidgetBridge local module.
// ─────────────────────────────────────────────────────────────────────────────

struct WidgetHistoryDay: Decodable {
    let date: String
    let level: Int
    let deep: Bool
}

struct WidgetSnapshot: Decodable {
    let anchorId: String?
    let anchorName: String
    let sigilSvg: String?
    let primedToday: Bool
    let streak: Int
    // Selected-anchor-only metrics (medium widget row). Optional so snapshots
    // written before these fields existed still decode.
    let anchorTotalSessions: Int?
    let anchorDayStreak: Int?
    let anchorDeepPrimeSessions: Int?
    let history: [WidgetHistoryDay]
    let lastPrimedDate: String?

    static let empty = WidgetSnapshot(
        anchorId: nil,
        anchorName: "Anchor",
        sigilSvg: nil,
        primedToday: false,
        streak: 0,
        anchorTotalSessions: 0,
        anchorDayStreak: 0,
        anchorDeepPrimeSessions: 0,
        history: [],
        lastPrimedDate: nil
    )

    /** Widget-gallery preview data only — real renders always use stored data. */
    static var preview: WidgetSnapshot {
        var history: [WidgetHistoryDay] = []
        let calendar = Calendar.current
        for offset in stride(from: 125, through: 0, by: -1) {
            guard let day = calendar.date(byAdding: .day, value: -offset, to: Date()) else { continue }
            let seed = abs(Int(sin(Double(offset) * 12.9898) * 43758.5453)) % 100
            let recency = Double(125 - offset) / 125.0
            let active = Double(seed) < (8.0 + recency * recency * 70.0)
            let level = active ? (seed % 3) + 1 : 0
            let deep = active && recency > 0.55 && seed % 13 == 0
            history.append(
                WidgetHistoryDay(date: AnchorDates.dayString(day), level: level, deep: deep)
            )
        }
        let today = AnchorDates.dayString(Date())
        return WidgetSnapshot(
            anchorId: "preview-anchor",
            anchorName: "Deep Work Every Morning",
            sigilSvg: nil,
            primedToday: true,
            streak: 6,
            anchorTotalSessions: 24,
            anchorDayStreak: 6,
            anchorDeepPrimeSessions: 5,
            history: history,
            lastPrimedDate: today
        )
    }
}

enum AnchorWidgetStore {
    // Must stay in sync with WIDGET_APP_GROUP / WIDGET_IOS_SNAPSHOT_KEY in
    // src/widgets/widgetTypes.ts and AnchorWidgetBridgeModule.swift.
    static let appGroup = "group.com.anchorintentions.app.widget"
    static let snapshotKey = "widgetSnapshot"

    static func load() -> WidgetSnapshot {
        guard
            let defaults = UserDefaults(suiteName: appGroup),
            let json = defaults.string(forKey: snapshotKey),
            let data = json.data(using: .utf8),
            let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
        else {
            return .empty
        }
        return snapshot
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Palette + fonts — values from the approved widget spec. Do not tweak.
// ─────────────────────────────────────────────────────────────────────────────

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

enum AnchorPalette {
    static let bg = Color(hex: 0x080C10)
    static let gold = Color(hex: 0xD4AF37)
    static let bone = Color(hex: 0xF5F5DC)
    static let dimGlyph = Color(hex: 0x3D4147)
    static let mutedLabel = Color(hex: 0x9A9488)
    static let faintLabel = Color(hex: 0x8A8577)
    static let silverLabel = Color(hex: 0xC0C0C0)

    /// FIX #1 (small widget, not-primed): visible silver ring —
    /// rgba(192,192,192,0.14). Required; do not dim back to white 0.05.
    static let ringNotPrimed = Color(hex: 0xC0C0C0, alpha: 0.14)
    static let ringPrimed = Color(hex: 0xD4AF37, alpha: 0.16)
    static let ctaBorderPrimed = Color(hex: 0xD4AF37, alpha: 0.4)

    /// Heatmap: Focus (gold) levels 0–3
    static let heatGold: [Color] = [
        Color(hex: 0x161A1F), Color(hex: 0x57491F), Color(hex: 0x9C7C26), Color(hex: 0xE8C860),
    ]
    /// Heatmap: Deep Prime (Deep Purple) levels 1–3 (index 0 unused)
    static let heatDeep: [Color] = [
        Color(hex: 0x161A1F), Color(hex: 0x5C4079), Color(hex: 0x7E58A6), Color(hex: 0x9D74CF),
    ]
}

enum AnchorFont {
    // Bundled in targets/widget/assets + registered via UIAppFonts in Info.plist.
    static func display(_ size: CGFloat) -> Font { .custom("Cinzel-Medium", size: size) }
    static func displaySemiBold(_ size: CGFloat) -> Font { .custom("Cinzel-SemiBold", size: size) }
    static func serifSemiBold(_ size: CGFloat) -> Font { .custom("CrimsonPro-SemiBold", size: size) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────

enum AnchorDates {
    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static func dayString(_ date: Date) -> String {
        dayFormatter.string(from: date)
    }

    /// Primed is recomputed per timeline-entry date so the widget flips back
    /// to "Ready to Prime" at local midnight without an app-driven sync.
    static func isPrimed(_ snapshot: WidgetSnapshot, at date: Date) -> Bool {
        guard let lastPrimed = snapshot.lastPrimedDate else { return false }
        return lastPrimed == dayString(date)
    }

    static func startOfIsoWeek(_ date: Date) -> Date {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone.current
        let components = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return calendar.date(from: components) ?? date
    }

    static func nextLocalMidnight(after date: Date) -> Date {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        return calendar.date(byAdding: .day, value: 1, to: startOfDay) ?? date.addingTimeInterval(86_400)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline provider
// ─────────────────────────────────────────────────────────────────────────────

struct AnchorEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot

    var primed: Bool { AnchorDates.isPrimed(snapshot, at: date) }
}

struct AnchorProvider: TimelineProvider {
    func placeholder(in context: Context) -> AnchorEntry {
        AnchorEntry(date: Date(), snapshot: .preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (AnchorEntry) -> Void) {
        let snapshot: WidgetSnapshot = context.isPreview ? .preview : AnchorWidgetStore.load()
        completion(AnchorEntry(date: Date(), snapshot: snapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AnchorEntry>) -> Void) {
        let snapshot = AnchorWidgetStore.load()
        let now = Date()
        let midnight = AnchorDates.nextLocalMidnight(after: now)
        // Two entries: now, and the local-midnight rollover (primed → unprimed).
        // Refresh interval ~15 min; the app also forces reloads on every sync.
        let entries = [
            AnchorEntry(date: now, snapshot: snapshot),
            AnchorEntry(date: midnight, snapshot: snapshot),
        ]
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(15 * 60))))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Anchor glyph — same geometry in every state (viewBox 0 0 120 130)
// ─────────────────────────────────────────────────────────────────────────────

struct AnchorGlyphShape: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width / 120, rect.height / 130)
        let dx = rect.minX + (rect.width - 120 * scale) / 2
        let dy = rect.minY + (rect.height - 130 * scale) / 2
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: dx + x * scale, y: dy + y * scale)
        }

        var path = Path()
        // circle cx=60 cy=18 r=9
        path.addEllipse(in: CGRect(
            x: dx + (60 - 9) * scale, y: dy + (18 - 9) * scale,
            width: 18 * scale, height: 18 * scale
        ))
        // shank
        path.move(to: pt(60, 27)); path.addLine(to: pt(60, 104))
        // stock
        path.move(to: pt(41, 44)); path.addLine(to: pt(79, 44))
        // arms
        path.move(to: pt(60, 104)); path.addQuadCurve(to: pt(25, 72), control: pt(28, 104))
        path.move(to: pt(60, 104)); path.addQuadCurve(to: pt(95, 72), control: pt(92, 104))
        // flukes
        path.move(to: pt(25, 72)); path.addLine(to: pt(21, 78))
        path.move(to: pt(25, 72)); path.addLine(to: pt(31, 74))
        path.move(to: pt(95, 72)); path.addLine(to: pt(99, 78))
        path.move(to: pt(95, 72)); path.addLine(to: pt(89, 74))
        return path
    }
}

struct AnchorGlyph: View {
    /// Stroke width in glyph units (spec: 4.6 small / 5.2 medium / 5.4 large)
    let strokeWidth: CGFloat
    let color: Color
    let opacity: Double
    let glow: Bool

    var body: some View {
        GeometryReader { geo in
            let scale = min(geo.size.width / 120, geo.size.height / 130)
            AnchorGlyphShape()
                .stroke(
                    color,
                    style: StrokeStyle(lineWidth: strokeWidth * scale, lineCap: .round, lineJoin: .round)
                )
                .opacity(opacity)
                .shadow(
                    color: glow ? AnchorPalette.gold.opacity(0.55) : .clear,
                    radius: glow ? 7 : 0
                )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Small (systemSmall) — symbol + state only
// ─────────────────────────────────────────────────────────────────────────────

struct SmallWidgetView: View {
    var entry: AnchorEntry

    private var primeURL: URL? {
        guard let anchorId = entry.snapshot.anchorId else {
            return URL(string: "anchor://practice")
        }
        var components = URLComponents(string: "anchor://prime")
        components?.queryItems = [URLQueryItem(name: "anchorId", value: anchorId)]
        return components?.url
    }

    var body: some View {
        let primed = entry.primed
        GeometryReader { geo in
            ZStack {
                if primed {
                    RadialGradient(
                        colors: [AnchorPalette.gold.opacity(0.16), .clear],
                        center: UnitPoint(x: 0.5, y: 0.46),
                        startRadius: 0,
                        endRadius: max(geo.size.width, geo.size.height) * 0.62
                    )
                }
                AnchorGlyph(
                    strokeWidth: 4.6,
                    color: primed ? AnchorPalette.gold : AnchorPalette.dimGlyph,
                    opacity: primed ? 1 : 0.9,
                    glow: primed
                )
                .frame(width: geo.size.width * 0.46, height: geo.size.height * 0.46)
                .position(x: geo.size.width / 2, y: geo.size.height / 2)
            }
        }
        .widgetRing(primed: primed)
        .widgetURL(primeURL)
        .containerBackground(for: .widget) { AnchorPalette.bg }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Medium (systemMedium) — glyph · name · state + CTA
// ─────────────────────────────────────────────────────────────────────────────

struct SparkIcon: Shape {
    // M12 3v4  M12 17v4  M3 12h4  M17 12h4  (24 × 24)
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 24
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * s, y: rect.minY + y * s)
        }
        var path = Path()
        path.move(to: pt(12, 3)); path.addLine(to: pt(12, 7))
        path.move(to: pt(12, 17)); path.addLine(to: pt(12, 21))
        path.move(to: pt(3, 12)); path.addLine(to: pt(7, 12))
        path.move(to: pt(17, 12)); path.addLine(to: pt(21, 12))
        return path
    }
}

struct ArrowIcon: Shape {
    // M5 12h13  M13 6l6 6-6 6  (24 × 24)
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 24
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * s, y: rect.minY + y * s)
        }
        var path = Path()
        path.move(to: pt(5, 12)); path.addLine(to: pt(18, 12))
        path.move(to: pt(13, 6)); path.addLine(to: pt(19, 12)); path.addLine(to: pt(13, 18))
        return path
    }
}

struct MediumMetric: View {
    let value: String
    let label: String
    var color: Color = AnchorPalette.gold

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(AnchorFont.displaySemiBold(16))
                .foregroundColor(color)
            Text(label)
                .font(AnchorFont.display(7))
                .kerning(0.85)
                .foregroundColor(AnchorPalette.silverLabel)
        }
        .frame(maxWidth: .infinity)
    }
}

struct MediumWidgetView: View {
    var entry: AnchorEntry

    private var practiceURL: URL? { URL(string: "anchor://practice") }

    var body: some View {
        let primed = entry.primed
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 13) {
                AnchorGlyph(
                    strokeWidth: 5.2,
                    color: primed ? AnchorPalette.gold : AnchorPalette.dimGlyph,
                    opacity: primed ? 1 : 0.9,
                    glow: primed
                )
                .frame(width: 30, height: 33)

                VStack(alignment: .leading, spacing: 5) {
                    Text(entry.snapshot.anchorName)
                        .font(AnchorFont.serifSemiBold(23))
                        .kerning(0.23)
                        .foregroundColor(AnchorPalette.bone)
                        .lineLimit(1)
                        .truncationMode(.tail)

                    HStack(spacing: 7) {
                        Circle()
                            .fill(primed ? AnchorPalette.gold : AnchorPalette.dimGlyph)
                            .frame(width: 7, height: 7)
                            .shadow(
                                color: primed ? AnchorPalette.gold.opacity(0.7) : .clear,
                                radius: primed ? 6 : 0
                            )
                        Text(primed ? "PRIMED TODAY" : "READY TO PRIME")
                            .font(AnchorFont.display(10))
                            .kerning(1.6)
                            .foregroundColor(primed ? AnchorPalette.gold : AnchorPalette.mutedLabel)
                    }
                }
                Spacer(minLength: 0)
            }

            Spacer(minLength: 0)

            // This anchor's metrics — the 4×4 carries the practice-wide numbers
            HStack(spacing: 0) {
                MediumMetric(value: String(entry.snapshot.anchorTotalSessions ?? 0), label: "SESSIONS")
                Rectangle().fill(Color.white.opacity(0.07)).frame(width: 1, height: 24)
                MediumMetric(value: String(entry.snapshot.anchorDayStreak ?? 0), label: "DAY THREAD")
                Rectangle().fill(Color.white.opacity(0.07)).frame(width: 1, height: 24)
                MediumMetric(
                    value: String(entry.snapshot.anchorDeepPrimeSessions ?? 0),
                    label: "DEEP PRIMES",
                    color: AnchorPalette.heatDeep[3]
                )
            }

            Spacer(minLength: 0)

            // CTA — both states re-enter the same Focus session entry point
            Link(destination: practiceURL ?? URL(fileURLWithPath: "/")) {
                HStack(spacing: 8) {
                    Text(primed ? "OPEN FOCUS" : "PRIME NOW")
                        .font(AnchorFont.display(12))
                        .kerning(2.16)
                    Group {
                        if primed {
                            ArrowIcon().stroke(style: StrokeStyle(lineWidth: 2.2 * 14 / 24, lineCap: .round, lineJoin: .round))
                                .frame(width: 14, height: 14)
                        } else {
                            SparkIcon().stroke(style: StrokeStyle(lineWidth: 2.2 * 13 / 24, lineCap: .round, lineJoin: .round))
                                .frame(width: 13, height: 13)
                        }
                    }
                }
                .foregroundColor(primed ? AnchorPalette.gold : AnchorPalette.bg)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(primed ? Color.clear : AnchorPalette.gold)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(primed ? AnchorPalette.ctaBorderPrimed : .clear, lineWidth: 1)
                )
            }
        }
        .padding(EdgeInsets(top: 18, leading: 18, bottom: 16, trailing: 18))
        .widgetRing(primed: primed)
        .widgetURL(practiceURL)
        .containerBackground(for: .widget) {
            ZStack {
                AnchorPalette.bg
                if primed {
                    RadialGradient(
                        colors: [AnchorPalette.gold.opacity(0.12), .clear],
                        center: UnitPoint(x: 0.16, y: 0.2),
                        startRadius: 0,
                        endRadius: 300
                    )
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Large (systemLarge) — 18-week session history heatmap
// ─────────────────────────────────────────────────────────────────────────────

struct HeatmapView: View {
    let history: [WidgetHistoryDay]
    let primed: Bool
    let referenceDate: Date

    private static let weeks = 18
    private static let gap: CGFloat = 3

    var body: some View {
        let byDate = Dictionary(uniqueKeysWithValues: history.map { ($0.date, $0) })
        let today = AnchorDates.dayString(referenceDate)
        let calendar = Calendar.current
        let gridStart = calendar.date(
            byAdding: .day,
            value: -7 * (Self.weeks - 1),
            to: AnchorDates.startOfIsoWeek(referenceDate)
        ) ?? referenceDate

        Canvas { context, size in
            let cell = min(
                (size.width - Self.gap * CGFloat(Self.weeks - 1)) / CGFloat(Self.weeks),
                (size.height - Self.gap * 6) / 7
            )
            let gridWidth = cell * CGFloat(Self.weeks) + Self.gap * CGFloat(Self.weeks - 1)
            let gridHeight = cell * 7 + Self.gap * 6
            let originX = (size.width - gridWidth) / 2
            let originY = (size.height - gridHeight) / 2

            for col in 0..<Self.weeks {
                for row in 0..<7 {
                    guard let cellDate = calendar.date(byAdding: .day, value: col * 7 + row, to: gridStart) else { continue }
                    let dateString = AnchorDates.dayString(cellDate)
                    if dateString > today { continue } // future days stay empty

                    let rect = CGRect(
                        x: originX + CGFloat(col) * (cell + Self.gap),
                        y: originY + CGFloat(row) * (cell + Self.gap),
                        width: cell,
                        height: cell
                    )
                    let isToday = dateString == today
                    let day = byDate[dateString]

                    let color: Color
                    if isToday {
                        // Spec: today = level-3 gold when primed, empty when not.
                        color = primed ? AnchorPalette.heatGold[3] : AnchorPalette.heatGold[0]
                    } else if let day, day.level > 0 {
                        let level = min(max(day.level, 1), 3)
                        color = day.deep ? AnchorPalette.heatDeep[level] : AnchorPalette.heatGold[level]
                    } else {
                        color = AnchorPalette.heatGold[0]
                    }

                    let shape = Path(roundedRect: rect, cornerRadius: 2.5)
                    if isToday && primed {
                        let halo = Path(
                            roundedRect: rect.insetBy(dx: -2.5, dy: -2.5),
                            cornerRadius: 4
                        )
                        context.fill(halo, with: .color(AnchorPalette.gold.opacity(0.38)))
                        context.fill(shape, with: .color(color))
                        context.stroke(
                            shape,
                            with: .color(Color(hex: 0xFFF0BE, alpha: 0.6)),
                            lineWidth: 1
                        )
                    } else {
                        context.fill(shape, with: .color(color))
                    }
                }
            }
        }
    }
}

struct LegendSwatch: View {
    let color: Color
    var body: some View {
        RoundedRectangle(cornerRadius: 2.5)
            .fill(color)
            .frame(width: 9, height: 9)
    }
}

struct LargeWidgetView: View {
    var entry: AnchorEntry

    var body: some View {
        let primed = entry.primed
        VStack(alignment: .leading, spacing: 0) {
            // ── Header ──
            HStack(alignment: .center, spacing: 12) {
                // Glyph dims to 0.5 (not 0.9) here — the heatmap carries the
                // primed signal on this size. Intentional; do not "fix".
                AnchorGlyph(
                    strokeWidth: 5.4,
                    color: AnchorPalette.gold,
                    opacity: primed ? 1 : 0.5,
                    glow: primed
                )
                .frame(width: 30, height: 33)

                VStack(alignment: .leading, spacing: 3) {
                    Text(entry.snapshot.anchorName)
                        .font(AnchorFont.serifSemiBold(19))
                        .kerning(0.19)
                        .foregroundColor(AnchorPalette.bone)
                        .lineLimit(1)
                        .truncationMode(.tail)
                    Text("SESSION HISTORY · LAST 18 WEEKS")
                        .font(AnchorFont.display(8.5))
                        .kerning(1.7)
                        .foregroundColor(AnchorPalette.faintLabel)
                }

                Spacer(minLength: 0)

                VStack(alignment: .trailing, spacing: 3) {
                    Text("\(entry.snapshot.streak)")
                        .font(AnchorFont.displaySemiBold(22))
                        .foregroundColor(AnchorPalette.gold)
                    Text("DAY THREAD")
                        .font(AnchorFont.display(8))
                        .kerning(1.28)
                        .foregroundColor(AnchorPalette.faintLabel)
                }
            }

            // ── Heatmap ──
            HeatmapView(history: entry.snapshot.history, primed: primed, referenceDate: entry.date)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.top, 15)
                .padding(.bottom, 12)

            // ── Legend ──
            HStack {
                HStack(spacing: 6) {
                    LegendSwatch(color: AnchorPalette.gold)
                    Text("FOCUS")
                        .font(AnchorFont.display(8.5))
                        .kerning(1.19)
                        .foregroundColor(AnchorPalette.silverLabel)
                    LegendSwatch(color: AnchorPalette.heatDeep[3])
                        .padding(.leading, 9)
                    Text("DEEP PRIME")
                        .font(AnchorFont.display(8.5))
                        .kerning(1.19)
                        .foregroundColor(AnchorPalette.silverLabel)
                }
                Spacer()
                HStack(spacing: 5) {
                    Text("LESS")
                        .font(AnchorFont.display(8))
                        .kerning(0.96)
                        .foregroundColor(AnchorPalette.faintLabel)
                    LegendSwatch(color: AnchorPalette.heatGold[0])
                    LegendSwatch(color: AnchorPalette.heatGold[1])
                    LegendSwatch(color: AnchorPalette.heatGold[2])
                    LegendSwatch(color: AnchorPalette.heatGold[3])
                    Text("MORE")
                        .font(AnchorFont.display(8))
                        .kerning(0.96)
                        .foregroundColor(AnchorPalette.faintLabel)
                }
            }
        }
        .padding(EdgeInsets(top: 20, leading: 20, bottom: 17, trailing: 20))
        .widgetRing(primed: primed)
        .containerBackground(for: .widget) {
            ZStack {
                AnchorPalette.bg
                // radial-gradient(120% 60% at 82% -6%, rgba(62,44,91,0.24), transparent) — both states
                RadialGradient(
                    colors: [Color(hex: 0x3E2C5B, alpha: 0.24), .clear],
                    center: UnitPoint(x: 0.82, y: -0.06),
                    startRadius: 0,
                    endRadius: 260
                )
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared ring overlay
// ─────────────────────────────────────────────────────────────────────────────

extension View {
    /// 1-pt state ring hugging the widget container shape.
    /// Not-primed uses the required visible silver value (Fix #1).
    func widgetRing(primed: Bool) -> some View {
        overlay(
            ContainerRelativeShape()
                .strokeBorder(
                    primed ? AnchorPalette.ringPrimed : AnchorPalette.ringNotPrimed,
                    lineWidth: 1
                )
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Widget declarations
// ─────────────────────────────────────────────────────────────────────────────

struct AnchorSmallWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AnchorSmallWidget", provider: AnchorProvider()) { entry in
            SmallWidgetView(entry: entry)
        }
        .configurationDisplayName("Anchor")
        .description("Your anchor at a glance — glows gold once you prime.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

struct AnchorMediumWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AnchorMediumWidget", provider: AnchorProvider()) { entry in
            MediumWidgetView(entry: entry)
        }
        .configurationDisplayName("Anchor — Prime")
        .description("Today's anchor with a one-tap way into your Focus session.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

struct AnchorLargeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AnchorLargeWidget", provider: AnchorProvider()) { entry in
            LargeWidgetView(entry: entry)
        }
        .configurationDisplayName("Anchor — Session History")
        .description("Your day thread and 18 weeks of session history.")
        .supportedFamilies([.systemLarge])
        .contentMarginsDisabled()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Previews
// ─────────────────────────────────────────────────────────────────────────────

#Preview("Small · Primed", as: .systemSmall) {
    AnchorSmallWidget()
} timeline: {
    AnchorEntry(date: .now, snapshot: .preview)
}

#Preview("Small · Ready", as: .systemSmall) {
    AnchorSmallWidget()
} timeline: {
    AnchorEntry(date: .now, snapshot: .empty)
}

#Preview("Medium · Primed", as: .systemMedium) {
    AnchorMediumWidget()
} timeline: {
    AnchorEntry(date: .now, snapshot: .preview)
}

#Preview("Large · Primed", as: .systemLarge) {
    AnchorLargeWidget()
} timeline: {
    AnchorEntry(date: .now, snapshot: .preview)
}
