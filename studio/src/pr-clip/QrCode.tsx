import qrcode from "qrcode-generator"
import React from "react"

/** A finder eye is 7 modules square; the quiet zone around the code is 3 (the spec's 4, less the tile's white). */
const eye = 7
export const quietModules = 3
/** A dot's radius in modules: 85 % of a module across. */
const dot = 0.425
/**
 * Alignment pattern centres per version (ISO 18004 annex E), versions 2–10; a short issue URL is version 3. Drawn
 * solid like the eyes: as loose dots a scanner's 1:1:1 run check misses them and reads the code less often.
 */
const alignment: Record<number, number[]> = { 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] }

type QrCodeProps = { text: string; size: number; color: string }

/**
 * A QR code that reads as part of the card, not a black box: round dots, the three
 * finder eyes and the alignment pattern as rounded squares, all in one dark ink on a light panel, no logo in
 * the middle. Error level L: a screen doesn't get scratched, and a short issue URL then fits version 3
 * (29 modules), so the dots stay big in the end card's 180 px panel. `size` includes the
 * quiet zone. check.sh decodes it from the share copy, so a look that breaks scanning fails a row.
 */
export const QrCode: React.FC<QrCodeProps> = ({ text, size, color }) => {
  const qr = qrcode(0, "L")
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  const corners = [
    [0, 0],
    [n - eye, 0],
    [0, n - eye],
  ]
  const inEye = (row: number, col: number) => corners.some(([x, y]) => col >= x && col < x + eye && row >= y && row < y + eye)
  const at = alignment[(n - 17) / 4] ?? []
  const last = at.at(-1)
  // Every pair of centres, less the three that would sit on a finder eye.
  const aligns = at.flatMap((y) => at.filter((x) => !((x === 6 && y === 6) || (x === 6 && y === last) || (x === last && y === 6))).map((x) => [x, y]))
  const inAlign = (row: number, col: number) => aligns.some(([x, y]) => Math.abs(col - x) <= 2 && Math.abs(row - y) <= 2)
  // One path of circles, two arcs each, rather than hundreds of <circle>s.
  let dots = ""
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!qr.isDark(row, col) || inEye(row, col) || inAlign(row, col)) continue
      dots += `M${col + 0.5 - dot} ${row + 0.5}a${dot} ${dot} 0 1 0 ${2 * dot} 0a${dot} ${dot} 0 1 0 ${-2 * dot} 0`
    }
  }

  return (
    <svg width={size} height={size} viewBox={`${-quietModules} ${-quietModules} ${n + 2 * quietModules} ${n + 2 * quietModules}`} style={{ display: "block" }}>
      <path d={dots} fill={color} />
      {corners.map(([x, y]) => (
        <g key={`eye-${x}-${y}`} fill={color}>
          <path
            fillRule="evenodd"
            d={`M${x + 1} ${y}h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1z M${x + 1.5} ${y + 1}h4a0.5 0.5 0 0 1 0.5 0.5v4a0.5 0.5 0 0 1 -0.5 0.5h-4a0.5 0.5 0 0 1 -0.5 -0.5v-4a0.5 0.5 0 0 1 0.5 -0.5z`}
          />
          <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.6} />
        </g>
      ))}
      {aligns.map(([x, y]) => (
        <g key={`align-${x}-${y}`} fill={color}>
          <path fillRule="evenodd" d={`M${x - 1.4} ${y - 2}h3.8a0.6 0.6 0 0 1 0.6 0.6v3.8a0.6 0.6 0 0 1 -0.6 0.6h-3.8a0.6 0.6 0 0 1 -0.6 -0.6v-3.8a0.6 0.6 0 0 1 0.6 -0.6z M${x - 1} ${y - 1}h3v3h-3z`} />
          <circle cx={x + 0.5} cy={y + 0.5} r={dot} />
        </g>
      ))}
    </svg>
  )
}
