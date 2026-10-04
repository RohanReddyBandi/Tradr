import { useEffect, useMemo, useState } from 'react'
import { uptrendChart } from '../../../lib/lessons'
import { lineVerdict, readLine, type Line } from '../../../lib/userMarkup'
import { DrawingLayer } from '../../../components/DrawingLayer'
import { SvgChart } from '../../../components/SvgChart'
import { COLORS } from '../../../theme'
import { Goals, Note, PillButton, Stage, type LessonProps } from './parts'

// Draw a trendline under an uptrend's lows, and see it graded the same way
// the Breakdown grades lines you draw on a trade: touches, and closes through it.
export function TrendlineDrawer({ done, onDone }: LessonProps) {
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 1000))
  const candles = useMemo(() => uptrendChart(seed), [seed])
  const slots = candles.length + 6
  const [line, setLine] = useState<Line | null>(null)
  const [nailed, setNailed] = useState(done)

  const reading = line ? readLine(candles, line) : null
  const verdict = reading ? lineVerdict(reading) : null
  const good = reading?.role === 'support' && verdict === 'strong'
  if (good && !nailed) setNailed(true)
  useEffect(() => {
    if (nailed && !done) onDone()
  }, [nailed, done, onDone])

  let note: { tone: 'good' | 'nudge' | 'plain'; text: string }
  if (!reading || !line) note = { tone: 'plain', text: 'Press on one of the dips, drag along to a later dip, and let go. The ends snap onto nearby lows.' }
  else if (reading.role === 'resistance')
    note = { tone: 'nudge', text: "That line is over the price, which makes it a ceiling. In an uptrend, the line that matters runs under the dips." }
  else if (verdict === 'cut') note = { tone: 'nudge', text: `Price closes below it ${reading.crossings} times, so it's cutting through the candles. Connect the lowest dips instead.` }
  else if (verdict === 'strong')
    note = { tone: 'good', text: `${reading.touches.length} touches and price respected every one. That's a trendline traders would watch: a close below it would be the first sign the uptrend is over.` }
  else if (verdict === 'ok') note = { tone: 'plain', text: 'Two touches: that makes a line, but a third touch is what confirms it. Can you find a line that catches three dips?' }
  else note = { tone: 'plain', text: 'Price barely touches that line. Start it on a dip and end it on a later dip.' }

  return (
    <div className="flex flex-col gap-4">
      <Stage>
        <SvgChart
          candles={candles}
          slots={slots}
          height={280}
          label="An uptrend to draw a trendline on"
          overlay={(project) => (
            <DrawingLayer
              project={project}
              candles={candles}
              slots={slots}
              tool="trend"
              drawings={line ? [line] : []}
              selected={null}
              onAdd={(d) => d.kind === 'trend' && setLine(d)}
              onPickCandle={() => {}}
            />
          )}
        >
          {(scale) =>
            reading && (
              <g>
                {reading.touches.map((i) => (
                  <circle key={i} cx={scale.x(i)} cy={scale.y(candles[i].low)} r={6} fill="none" stroke={COLORS.up} strokeWidth={1.5} />
                ))}
              </g>
            )
          }
        </SvgChart>
      </Stage>
      <Note tone={note.tone}>{note.text}</Note>
      <div className="flex flex-wrap items-center gap-3">
        <Goals goals={[{ label: 'A trendline with 3 touches', met: nailed }]} />
        <PillButton onClick={() => setLine(null)} disabled={!line}>
          Clear
        </PillButton>
        <PillButton
          onClick={() => {
            setSeed(1 + Math.floor(Math.random() * 1000))
            setLine(null)
          }}
        >
          New chart
        </PillButton>
      </div>
    </div>
  )
}
