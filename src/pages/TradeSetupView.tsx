import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Candle } from '../types'
import type { PendingTrade } from '../game/useGame'
import { CandleChart } from '../components/CandleChart'
import { TradeLines } from '../components/TradeLines'
import { BackIcon } from '../components/icons'
import {
  DEFAULT_POSITION_SHARE,
  defaultPlan,
  planProblem,
  riskAndReward,
  type Direction,
  type TradePlan,
} from '../lib/trade'
import { formatMoney } from '../format'

interface Props {
  pending: PendingTrade
  balance: number
  onConfirm: (plan: TradePlan) => void
  onCancel: () => void
}

const SIZE_CHOICES = [0.05, 0.1, 0.25, 1] // quick-pick shares of your balance (1 = all of it)

// "1,000.00" -> 1000. Commas and dollar signs are ignored.
const parseAmount = (text: string) => Number(text.replace(/[$,\s]/g, ''))
const asAmount = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// The price range the chart shows: every candle plus the stop and target,
// with a little room above and below.
function chartRange(candles: Candle[], levels: number[]) {
  const prices = [...candles.flatMap((c) => [c.low, c.high]), ...levels.filter(Number.isFinite)]
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const pad = (max - min) * 0.08
  return { min: min - pad, max: max + pad }
}

export function TradeSetupView({ pending, balance, onConfirm, onCancel }: Props) {
  const { card } = pending
  const [direction, setDirection] = useState<Direction>(pending.direction)
  const start = useMemo(
    () => defaultPlan(card.candles, pending.direction, balance * DEFAULT_POSITION_SHARE),
    [card, pending.direction, balance],
  )

  // The form keeps what you typed as text, so half-typed numbers like "12." don't get mangled.
  const [sizeText, setSizeText] = useState(asAmount(start.size))
  const [stopText, setStopText] = useState(start.stop.toFixed(2))
  const [targetText, setTargetText] = useState(start.target.toFixed(2))

  const plan: TradePlan = {
    direction,
    entry: start.entry,
    size: parseAmount(sizeText),
    stop: parseAmount(stopText),
    target: parseAmount(targetText),
  }
  const problem = planProblem(plan, balance)
  const { risk, reward } = riskAndReward(plan)
  const long = direction === 'long'

  // The chart's price range only grows when a level lands outside it (typed
  // in, or flipped by switching direction). Dragging stays inside, so the
  // chart never shifts under your finger.
  const [range, setRange] = useState(() => chartRange(card.candles, [start.stop, start.target]))
  function fitLevels(stop: number, target: number) {
    const outside = [stop, target].some((p) => Number.isFinite(p) && p > 0 && (p < range.min || p > range.max))
    if (outside) setRange(chartRange(card.candles, [stop, target]))
  }

  function typeLevel(level: 'stop' | 'target', text: string) {
    if (level === 'stop') setStopText(text)
    else setTargetText(text)
    const price = parseAmount(text)
    fitLevels(level === 'stop' ? price : plan.stop, level === 'target' ? price : plan.target)
  }

  // Escape goes back to the card.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  // Switching between long and short flips the stop and target to the other side.
  function chooseDirection(next: Direction) {
    if (next === direction) return
    const flipped = defaultPlan(card.candles, next, plan.size || start.size)
    setDirection(next)
    setStopText(flipped.stop.toFixed(2))
    setTargetText(flipped.target.toFixed(2))
    fitLevels(flipped.stop, flipped.target)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!problem) onConfirm(plan)
  }

  const sizeShare = plan.size / balance

  return (
    <form onSubmit={submit} className="h-full overflow-y-auto lg:overflow-hidden">
      <div className="mx-auto flex min-h-full max-w-md flex-col md:max-w-lg lg:grid lg:h-full lg:max-w-[1240px] lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)] lg:gap-10 lg:px-10 lg:py-8">
        {/* Left: the chart with draggable lines. */}
        <section className="flex flex-col lg:min-h-0">
          <header className="flex items-center justify-between px-3 pt-4 pb-2 lg:px-0 lg:pt-0 lg:pb-4">
            <button
              type="button"
              onClick={onCancel}
              aria-label="Back to the card"
              className="grid size-11 place-items-center rounded-full text-neutral-200 transition-colors hover:bg-neutral-900"
            >
              <BackIcon />
            </button>
            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Set up trade</h1>
            <span
              className={`rounded-full border px-4 py-1.5 text-sm font-bold ${
                long ? 'border-up/30 bg-up/10 text-up' : 'border-down/30 bg-down/10 text-down'
              }`}
            >
              {long ? 'BUY' : 'SELL'}
            </span>
          </header>

          <div className="h-[248px] px-2 tall:h-[262px] lg:min-h-[360px] lg:flex-1 lg:rounded-3xl lg:border lg:border-edge lg:bg-card lg:p-3">
            <CandleChart
              candles={card.candles}
              slots={card.candles.length + 8}
              priceRange={range}
              label={`Chart of card ${card.number} with your entry, stop loss, and take profit`}
              overlay={(project) => (
                <TradeLines
                  project={project}
                  direction={direction}
                  entry={plan.entry}
                  stop={plan.stop}
                  target={plan.target}
                  range={range}
                  onChange={(level, price) => (level === 'stop' ? setStopText : setTargetText)(price.toFixed(2))}
                />
              )}
            />
          </div>
          <p className="px-4 pt-2 text-sm text-muted lg:px-0 lg:pt-3">Drag the lines on the chart or type a price</p>
        </section>

        {/* Right: the numbers. */}
        <div className="flex flex-1 flex-col gap-4 px-4 pt-3 lg:min-h-0 lg:gap-6 lg:overflow-y-auto lg:px-0 lg:pt-12">
          <div role="radiogroup" aria-label="Direction" className="grid grid-cols-2 gap-1 rounded-2xl border border-edge bg-card p-1">
            {(['long', 'short'] as const).map((d) => {
              const selected = direction === d
              const tone = d === 'long' ? 'border-up/40 bg-up/10 text-up' : 'border-down/40 bg-down/10 text-down'
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => chooseDirection(d)}
                  className={`h-11 rounded-xl border text-[17px] font-semibold transition-colors ${
                    selected ? tone : 'border-transparent text-muted hover:text-soft'
                  }`}
                >
                  {d === 'long' ? 'Buy (long)' : 'Sell (short)'}
                </button>
              )
            })}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="size" className="text-[15px] text-soft">
                Position size
              </label>
              <div className="flex gap-2">
                {SIZE_CHOICES.map((share) => {
                  const selected = Math.abs(plan.size - balance * share) < 0.01
                  return (
                    <button
                      key={share}
                      type="button"
                      onClick={() => setSizeText(asAmount(Math.round(balance * share * 100) / 100))}
                      className={`h-9 rounded-xl border px-3 text-sm transition-colors ${
                        selected ? 'border-neutral-600 bg-neutral-900 text-white' : 'border-edge text-muted hover:text-soft'
                      }`}
                    >
                      {share * 100}%
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="mt-2 flex h-12 items-center rounded-2xl border border-edge bg-card px-4 focus-within:border-neutral-500">
              <span className="font-mono text-lg text-muted">$</span>
              <input
                id="size"
                inputMode="decimal"
                autoComplete="off"
                value={sizeText}
                onChange={(e) => setSizeText(e.target.value)}
                onBlur={() => Number.isFinite(plan.size) && plan.size > 0 && setSizeText(asAmount(plan.size))}
                className="ml-1 min-w-0 flex-1 bg-transparent font-mono text-lg outline-none"
              />
              <span className="shrink-0 text-xs text-muted">
                {Number.isFinite(sizeShare) ? `${(sizeShare * 100).toFixed(sizeShare < 0.1 ? 1 : 0)}% of balance` : ''}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PriceInput id="stop" label="Stop loss" value={stopText} onChange={(v) => typeLevel('stop', v)} tone="text-down" />
            <PriceInput id="target" label="Take profit" value={targetText} onChange={(v) => typeLevel('target', v)} tone="text-up" />
          </div>

          <div className="grid grid-cols-3 divide-x divide-edge rounded-2xl border border-edge bg-card py-3 text-center">
            <Summary label="At risk" value={problem ? '—' : `−${formatMoney(risk)}`} tone="text-down" note={problem ? '' : `${((risk / balance) * 100).toFixed(1)}% of balance`} />
            <Summary label="Reward" value={problem ? '—' : `+${formatMoney(reward)}`} tone="text-up" />
            <Summary label="Risk : reward" value={problem || risk === 0 ? '—' : `1 : ${(reward / risk).toFixed(1)}`} tone="text-white" />
          </div>

          {/* Pushes the button to the bottom; on phones it sticks there while you scroll. */}
          <div className="sticky bottom-0 mt-auto bg-base pb-4 lg:static lg:mt-0 lg:pb-0">
            <p aria-live="polite" className="min-h-6 pb-1 text-sm text-amber">
              {problem}
            </p>
            <button
              type="submit"
              disabled={!!problem}
              className={`h-14 w-full rounded-2xl text-lg font-semibold text-black transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                long ? 'bg-up hover:bg-[#5fe6ab]' : 'bg-down hover:bg-[#f47a72]'
              }`}
            >
              Enter {direction} at {plan.entry.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

function PriceInput(props: { id: string; label: string; value: string; onChange: (v: string) => void; tone: string }) {
  return (
    <div>
      <label htmlFor={props.id} className="text-[15px] text-soft">
        {props.label}
      </label>
      <input
        id={props.id}
        inputMode="decimal"
        autoComplete="off"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={`mt-2 h-12 w-full rounded-2xl border border-edge bg-card px-4 font-mono text-lg outline-none focus:border-neutral-500 ${props.tone}`}
      />
    </div>
  )
}

function Summary({ label, value, tone, note }: { label: string; value: string; tone: string; note?: string }) {
  return (
    <div className="px-2">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-lg ${tone}`}>{value}</div>
      {note && <div className="mt-0.5 text-[11px] text-muted">{note}</div>}
    </div>
  )
}
