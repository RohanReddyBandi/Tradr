import { motion } from 'motion/react'
import type { Candle, Finding, Shape } from '../types'
import { COLORS } from '../theme'
import type { Projector } from './CandleChart'

interface Props {
  project: Projector
  candles: Candle[] // every candle, visible and replayed
  entryIndex: number // the last candle you saw before deciding
  shownCount: number // how many candles the replay has revealed so far
  exitColor: string // green if the replay went your way, red if not
  findings: Finding[]
  scanned: Finding[] // the pattern scanner's results: drawn only while their chip is active
  showFindings: boolean // patterns are drawn once the replay is done
  activeId: string | null // the pattern chip being hovered or tapped
  levels: { stop: number; target: number } | null // your stop loss and take profit
  exit: { index: number; price: number } | null // where the trade closed (candle index, price)
}

// Everything drawn on top of the Breakdown chart: the replay zone, entry and
// exit markers, and the pattern markup (grey for chart patterns, yellow for
// candlestick patterns).
export function Markup({ project, candles, entryIndex, shownCount, exitColor, findings, scanned, showFindings, activeId, levels, exit }: Props) {
  const { width, height } = project
  const x = (index: number) => project.x(index) ?? -100
  const y = (price: number) => project.y(price) ?? -100

  const divider = x(entryIndex + 0.5)
  const entry = candles[entryIndex]
  const latest = candles[shownCount - 1]
  const replaying = shownCount - 1 > entryIndex
  // Once the replay reaches the exit, the marker stays there; before that it follows price.
  const exited = exit && shownCount - 1 >= exit.index
  const marker = exited ? { index: exit.index, price: exit.price } : replaying ? { index: shownCount - 1, price: latest.close } : null

  // The candles outlined in yellow. Dot labels that land on them move aside.
  const boxes = findings.flatMap((f) => f.shapes.filter((s): s is CandleBoxShape => s.kind === 'candles'))

  // Chart patterns draw first, then candlestick patterns, one after another.
  const drawDelay = (k: number) => 0.15 + k * 0.35
  const dim = (f: Finding) => (activeId && activeId !== f.id ? 0.15 : 1)
  const activeScan = showFindings ? scanned.find((f) => f.id === activeId) : undefined

  return (
    <>
      <svg width={width} height={height} className="pointer-events-none absolute top-0 left-0 overflow-visible" aria-hidden="true">
        {/* The replay zone: slightly lighter, split off by a dotted line. */}
        <rect x={divider} y={0} width={Math.max(0, width - divider)} height={height} fill="#ffffff" opacity={0.035} />
        <line x1={divider} y1={0} x2={divider} y2={height} stroke="#5c5c5c" strokeDasharray="2 4" />
        <text x={divider + 8} y={16} fill={COLORS.axisText} fontSize={11}>
          Replay
        </text>

        {showFindings &&
          findings.map((f, k) => (
            <g key={f.id} opacity={dim(f)} style={{ transition: 'opacity 200ms' }}>
              {f.shapes.map((shape, s) => (
                <ShapeView key={s} shape={shape} finding={f} x={x} y={y} candles={candles} boxes={boxes} delay={drawDelay(k)} />
              ))}
            </g>
          ))}

        {/* A scanner result, in dashed white so it's clearly not the built-in markup. */}
        {activeScan && (
          <g key={activeScan.id}>
            {activeScan.shapes.map((shape, s) => (
              <ShapeView key={s} shape={shape} finding={activeScan} x={x} y={y} candles={candles} boxes={boxes} delay={0} scan />
            ))}
          </g>
        )}

        {/* Your stop loss and take profit, across the replay zone. */}
        {levels &&
          [
            { price: levels.target, color: COLORS.up, tag: 'TP' },
            { price: levels.stop, color: COLORS.down, tag: 'SL' },
          ].map((l) => (
            <g key={l.tag} opacity={0.75}>
              <line x1={divider} y1={y(l.price)} x2={width} y2={y(l.price)} stroke={l.color} strokeWidth={1.25} strokeDasharray="3 4" />
              <text x={width - 6} y={y(l.price) - 5} textAnchor="end" fill={l.color} fontSize={10.5} fontWeight={600}>
                {l.tag}
              </text>
            </g>
          ))}

        {/* Where you got in, and where you got out (or where the replay has got to). */}
        {marker && (
          <>
            <line x1={divider} y1={y(marker.price)} x2={x(marker.index)} y2={y(marker.price)} stroke={exitColor} strokeWidth={1.5} strokeDasharray="4 4" />
            <circle cx={x(marker.index)} cy={y(marker.price)} r={5.5} fill={COLORS.card} stroke={exitColor} strokeWidth={2} />
          </>
        )}
        <line x1={x(entryIndex)} y1={y(entry.close)} x2={x(entryIndex) + 22} y2={y(entry.close)} stroke="#e8e8e8" strokeWidth={1.5} />
        <circle cx={x(entryIndex)} cy={y(entry.close)} r={5} fill={COLORS.card} stroke="#e8e8e8" strokeWidth={2} />
      </svg>

      {/* Name tags. HTML instead of SVG so they size themselves to the text. */}
      {showFindings &&
        [...findings, ...(activeScan ? [activeScan] : [])].map((f, k) => {
          const tag = tagPosition(f, x, y, candles)
          if (!tag) return null
          const isCandle = f.type === 'candle'
          return (
            <motion.div
              key={f.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: dim(f) }}
              transition={{ delay: drawDelay(k) + 0.3, duration: 0.25 }}
              className="pointer-events-none absolute rounded-md border bg-base/85 px-1.5 py-0.5 text-[11px] leading-tight font-medium whitespace-nowrap"
              style={{
                left: Math.min(Math.max(tag.x, 8), width - 8),
                top: tag.y,
                transform: `translate(${tag.x < 70 ? '0' : tag.x > width - 70 ? '-100%' : '-50%'}, ${tag.above ? '-100%' : '0'})`,
                color: isCandle ? COLORS.marker : '#d4d4d4',
                borderColor: isCandle ? `${COLORS.marker}66` : '#3a3a3a',
              }}
            >
              {f.name}
            </motion.div>
          )
        })}
    </>
  )
}

// Where a finding's name tag goes. Candlestick patterns get their tag on the
// side the arrow points from: below the box for bullish, above for bearish.
function tagPosition(f: Finding, x: (i: number) => number, y: (p: number) => number, candles: Candle[]) {
  if (f.type === 'candle') {
    const box = f.shapes[0]
    if (box.kind !== 'candles') return null
    const { top, bottom } = candleBox(box, y, candles)
    const center = (x(box.fromIndex) + x(box.toIndex)) / 2
    return f.bias === 'bullish'
      ? { x: center, y: bottom + ARROW_LENGTH + 4, above: false }
      : { x: center, y: top - ARROW_LENGTH - 4, above: true }
  }
  if (!f.labelAt) return null
  return { x: x(f.labelAt.index), y: y(f.labelAt.price), above: true }
}

const ARROW_LENGTH = 18

type CandleBoxShape = Extract<Shape, { kind: 'candles' }>

function candleBox(box: CandleBoxShape, y: (p: number) => number, candles: Candle[]) {
  const slice = candles.slice(box.fromIndex, box.toIndex + 1)
  return {
    top: y(Math.max(...slice.map((c) => c.high))) - 6,
    bottom: y(Math.min(...slice.map((c) => c.low))) + 6,
  }
}

interface ShapeProps {
  shape: Shape
  finding: Finding
  x: (index: number) => number
  y: (price: number) => number
  candles: Candle[]
  boxes: CandleBoxShape[]
  delay: number
  scan?: boolean // a scanner result rather than the built-in markup
}

// One shape, drawn in with a quick pen stroke.
function ShapeView({ shape, finding, x, y, candles, boxes, delay, scan }: ShapeProps) {
  // Solid lines are drawn in like a pen stroke. The pen effect works by
  // animating the line's dash pattern, which would wipe out a dashed style,
  // so dashed shapes (levels, scanner results) fade in instead.
  const penStroke = { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.55, delay, ease: 'easeOut' as const } }
  const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay: delay + 0.35 } }
  const fadeLine = { initial: { opacity: 0 }, animate: { opacity: 0.9 }, transition: { duration: 0.35, delay } }
  const draw = scan ? fadeLine : penStroke
  const chalk = scan
    ? { stroke: '#ececec', strokeLinecap: 'round' as const, fill: 'none', strokeDasharray: '6 5' }
    : { stroke: COLORS.chalk, strokeLinecap: 'round' as const, fill: 'none' }

  switch (shape.kind) {
    case 'line': {
      const [x1, y1, x2, y2] = [x(shape.from.index), y(shape.from.price), x(shape.to.index), y(shape.to.price)]
      return (
        <g>
          <motion.line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={2.5} opacity={0.85} {...chalk} {...draw} />
          {/* Labels go at the left end: the right end is where the signal candles are. */}
          {shape.label && <motion.text x={x1 + 4} y={y1 - 8} fill={COLORS.chalk} fontSize={10.5} {...fadeIn}>{shape.label}</motion.text>}
        </g>
      )
    }
    case 'level': {
      const [x1, x2, py] = [x(shape.fromIndex), x(shape.toIndex), y(shape.price)]
      return (
        <g>
          <motion.line x1={x1} y1={py} x2={x2} y2={py} strokeWidth={1.5} {...chalk} strokeDasharray="7 5" {...fadeLine} />
          {shape.label && <motion.text x={x1 + 4} y={py - 6} fill={COLORS.chalk} fontSize={10.5} {...fadeIn}>{shape.label}</motion.text>}
        </g>
      )
    }
    case 'dot': {
      const [cx, cy] = [x(shape.at.index), y(shape.at.price)]
      // Normally the label sits above or below the dot. If the dot is on a
      // yellow-boxed candle, that spot is taken by the box's tag, so the
      // label goes to the left of the box instead.
      const box = boxes.find((b) => shape.at.index >= b.fromIndex - 1 && shape.at.index <= b.toIndex + 1)
      const label = box
        ? { x: x(box.fromIndex - 0.5) - 8, y: cy + 4, anchor: 'end' as const }
        : { x: cx, y: shape.place === 'above' ? cy - 10 : cy + 18, anchor: 'middle' as const }
      return (
        <motion.g {...fadeIn}>
          <circle cx={cx} cy={cy} r={4} fill={COLORS.card} stroke={COLORS.chalk} strokeWidth={1.75} />
          {shape.label && (
            <text x={label.x} y={label.y} textAnchor={label.anchor} fill="#cfcfcf" fontSize={10.5} fontWeight={500}>
              {shape.label}
            </text>
          )}
        </motion.g>
      )
    }
    case 'curve': {
      const d = shape.points.map((p, k) => `${k === 0 ? 'M' : 'L'} ${x(p.index)} ${y(p.price)}`).join(' ')
      return <motion.path d={d} strokeWidth={2.5} strokeLinejoin="round" opacity={0.85} {...chalk} {...draw} />
    }
    case 'candles': {
      const { top, bottom } = candleBox(shape, y, candles)
      const left = x(shape.fromIndex - 0.5) - 2
      const right = x(shape.toIndex + 0.5) + 2
      const center = (left + right) / 2
      // The arrow comes from the tag toward the box.
      const bullish = finding.bias === 'bullish'
      const tip = bullish ? bottom + 2 : top - 2
      const tail = bullish ? bottom + ARROW_LENGTH : top - ARROW_LENGTH
      const head = bullish ? 5 : -5
      return (
        <g>
          <motion.rect x={left} y={top} width={right - left} height={bottom - top} rx={5} fill={COLORS.marker} fillOpacity={0.07} stroke={COLORS.marker} strokeWidth={1.5} {...draw} />
          <motion.path
            d={`M ${center} ${tail} L ${center} ${tip} M ${center - 4} ${tip + head} L ${center} ${tip} L ${center + 4} ${tip + head}`}
            stroke={COLORS.marker}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            {...draw}
          />
        </g>
      )
    }
  }
}
