// A dependency-free inline-SVG chart (Phase G). Grouped bars with an optional
// overlaid line, a zero baseline, and light gridlines. Drawn as plain SVG so
// there's no charting library in the bundle and it prints cleanly to PDF.
//
// Props:
//   labels  — x-axis category labels (e.g. months)
//   bars    — [{ label, color, values:number[] }]  (0..n series, side by side)
//   line    — { label, color, values:number[] }    (optional overlay)
//   height  — px (default 240)
//   fmt     — value formatter for axis + legend totals (default toLocaleString)

const W = 720
const PAD = { l: 60, r: 16, t: 16, b: 40 }

function niceMax(v) {
  if (v <= 0) return 0
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}

export default function MiniChart({ labels = [], bars = [], line = null, height = 240, fmt }) {
  const format = fmt || ((v) => Math.round(v).toLocaleString('en-US'))
  const n = labels.length
  if (!n) return <div className="empty">No data to chart.</div>

  const allVals = [
    ...bars.flatMap((b) => b.values),
    ...(line ? line.values : []),
  ].filter((v) => Number.isFinite(v))
  const rawMax = Math.max(0, ...allVals)
  const rawMin = Math.min(0, ...allVals)
  const yMax = niceMax(rawMax) || 1
  const yMin = rawMin < 0 ? -niceMax(-rawMin) : 0
  const span = yMax - yMin || 1

  const plotW = W - PAD.l - PAD.r
  const plotH = height - PAD.t - PAD.b
  const slot = plotW / n
  const yOf = (v) => PAD.t + plotH * ((yMax - v) / span)
  const zeroY = yOf(0)

  // Gridlines at 0, 25, 50, 75, 100% of the value range.
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * span)

  // Bar geometry — series sit side by side, centred within each slot.
  const groupW = slot * 0.62
  const barW = bars.length ? groupW / bars.length : groupW

  const linePts = line
    ? line.values.map((v, i) => `${PAD.l + slot * (i + 0.5)},${yOf(v)}`).join(' ')
    : ''

  return (
    <div className="mini-chart">
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img">
        {/* gridlines + y labels */}
        {gridVals.map((gv, i) => {
          const y = yOf(gv)
          return (
            <g key={i}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} className="mc-grid" />
              <text x={PAD.l - 8} y={y + 4} textAnchor="end" className="mc-axis">
                {format(gv)}
              </text>
            </g>
          )
        })}
        {/* zero baseline (emphasised) */}
        <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} className="mc-zero" />

        {/* bars */}
        {labels.map((_, i) => {
          const gx = PAD.l + slot * i + (slot - groupW) / 2
          return bars.map((b, si) => {
            const v = b.values[i] || 0
            const y = yOf(Math.max(v, 0))
            const h = Math.abs(yOf(v) - zeroY)
            return (
              <rect
                key={b.label + i}
                x={gx + barW * si}
                y={v >= 0 ? y : zeroY}
                width={Math.max(1, barW - 2)}
                height={Math.max(0, h)}
                fill={b.color}
                rx="2"
              >
                <title>{`${labels[i]} · ${b.label}: ${format(v)}`}</title>
              </rect>
            )
          })
        })}

        {/* line overlay */}
        {line && <polyline points={linePts} className="mc-line" style={{ stroke: line.color }} />}
        {line &&
          line.values.map((v, i) => (
            <circle key={i} cx={PAD.l + slot * (i + 0.5)} cy={yOf(v)} r="3" fill={line.color}>
              <title>{`${labels[i]} · ${line.label}: ${format(v)}`}</title>
            </circle>
          ))}

        {/* x labels */}
        {labels.map((lb, i) => (
          <text key={i} x={PAD.l + slot * (i + 0.5)} y={height - PAD.b + 20} textAnchor="middle" className="mc-axis">
            {lb}
          </text>
        ))}
      </svg>

      <div className="mc-legend">
        {bars.map((b) => (
          <span key={b.label} className="mc-key">
            <i style={{ background: b.color }} /> {b.label}
          </span>
        ))}
        {line && (
          <span className="mc-key">
            <i className="mc-key-line" style={{ background: line.color }} /> {line.label}
          </span>
        )}
      </div>
    </div>
  )
}
