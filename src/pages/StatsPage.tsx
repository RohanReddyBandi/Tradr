import { useState, type ReactNode } from 'react'
import { STARTING_BALANCE, type Game } from '../game/useGame'
import type { PracticeProgress } from '../game/usePractice'
import { computeStats } from '../lib/stats'
import { DRAWABLE, PRACTICE_CANDLES } from '../lib/practice'
import { findEntry } from '../lib/library'
import { EquityChart } from '../components/EquityChart'
import { formatMoney, formatR, formatSignedMoney, formatSignedPercent } from '../format'

interface Props {
  game: Game
  practice: PracticeProgress
  onPlay: () => void // go to the Swipe tab
  onLearn: (patternName: string) => void // open a pattern in the Learn tab
}

const percent = (share: number | null) => (share === null ? '—' : `${Math.round(share * 100)}%`)

// Bar color for "how often you get it right": red, amber, then green.
const scoreColor = (share: number) => (share < 0.4 ? 'bg-down' : share < 0.7 ? 'bg-amber' : 'bg-up')

export function StatsPage({ game, practice, onPlay, onLearn }: Props) {
  const stats = computeStats(game.history, STARTING_BALANCE)
  const change = ((game.balance - STARTING_BALANCE) / STARTING_BALANCE) * 100
  const [confirmingReset, setConfirmingReset] = useState(false)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md px-4 pt-6 pb-12 md:max-w-lg lg:max-w-[1240px] lg:px-10 lg:py-8">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Stats</h1>
          {!confirmingReset ? (
            <button
              onClick={() => setConfirmingReset(true)}
              className="h-11 rounded-xl border border-neutral-800 px-4 text-[15px] text-soft transition-colors hover:border-neutral-600 hover:text-white"
            >
              Reset
            </button>
          ) : (
            <div className="flex items-center gap-2" role="group" aria-label="Confirm reset">
              <span className="hidden text-sm text-soft sm:inline">Start over at $10,000 and clear your history?</span>
              <button onClick={() => setConfirmingReset(false)} className="h-11 rounded-xl px-3 text-[15px] text-soft hover:text-white">
                Cancel
              </button>
              <button
                onClick={() => {
                  game.reset()
                  setConfirmingReset(false)
                }}
                className="h-11 rounded-xl border border-down/40 bg-down/10 px-4 text-[15px] font-medium text-down hover:bg-down/20"
              >
                Reset everything
              </button>
            </div>
          )}
        </header>

        <div className="lg:mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
          {/* Left: balance and equity curve. */}
          <section>
            <div className="mt-5 text-[15px] text-soft">Paper balance</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
              <span className="font-mono text-[44px] leading-tight font-medium tracking-tight">{formatMoney(game.balance)}</span>
              {game.balance !== STARTING_BALANCE && (
                <span className={`font-mono text-lg ${change >= 0 ? 'text-up' : 'text-down'}`}>{formatSignedPercent(change)}</span>
              )}
            </div>

            <div className="mt-5 rounded-3xl border border-edge bg-card px-4 pt-4 pb-3">
              <h2 className="px-1 text-[15px] text-soft">Equity by trade</h2>
              {stats.trades > 0 ? (
                <div className="mt-3">
                  <EquityChart equity={stats.equity} start={STARTING_BALANCE} />
                </div>
              ) : (
                <div className="flex h-[200px] flex-col items-center justify-center gap-4 text-center">
                  <p className="max-w-xs text-sm leading-relaxed text-muted">
                    Your balance after each trade shows up here. Skips don't count, since they don't change your balance.
                  </p>
                  <button onClick={onPlay} className="h-11 rounded-xl bg-up px-5 text-[15px] font-semibold text-black hover:bg-[#5fe6ab]">
                    Play a card
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Right: the numbers. */}
          <section className="mt-5 flex flex-col gap-6 lg:mt-5">
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Win rate" value={percent(stats.winRate)} note={`of ${stats.trades} trade${stats.trades === 1 ? '' : 's'}`} />
              <Tile
                label="Accuracy"
                value={percent(stats.accuracy)}
                note="stop and target vs best"
                tone={stats.accuracy === null ? '' : stats.accuracy < 0.4 ? 'text-down' : stats.accuracy < 0.7 ? 'text-amber' : 'text-up'}
              />
              <Tile label="Good reads" value={percent(stats.decisionAccuracy)} note="decision accuracy" tone="text-up" />
              <Tile
                label="Skipped winners"
                value={String(stats.skippedWinners)}
                note={`of ${stats.skips} skip${stats.skips === 1 ? '' : 's'}`}
                tone="text-amber"
              />
            </div>

            <div className="grid grid-cols-4 divide-x divide-edge rounded-2xl border border-edge bg-card py-3 text-center">
              <Small label="Cards played" value={String(stats.cards)} />
              <Small label="Avg R" value={stats.averageR === null ? '—' : formatR(stats.averageR)} />
              <Small label="Best trade" value={stats.best ? formatSignedMoney(stats.best.pnl) : '—'} tone={stats.best && stats.best.pnl > 0 ? 'text-up' : ''} />
              <Small label="Worst trade" value={stats.worst ? formatSignedMoney(stats.worst.pnl) : '—'} tone={stats.worst && stats.worst.pnl < 0 ? 'text-down' : ''} />
            </div>

            <p className="text-sm leading-relaxed text-muted">
              Good reads grades your decisions; win rate grades the results. Over time, the first one drives the second.
            </p>

            <Section title="Stop and target accuracy">
              <ScoreRow
                name="Stop loss"
                detail={stats.stopAccuracy === null ? 'no trades yet' : `${Math.round(stats.stopAccuracy * 100)}% on average`}
                share={stats.stopAccuracy}
              />
              <ScoreRow
                name="Take profit"
                detail={stats.targetAccuracy === null ? 'no trades yet' : `${Math.round(stats.targetAccuracy * 100)}% on average`}
                share={stats.targetAccuracy}
              />
              <p className="text-sm leading-relaxed text-muted">
                How close your levels were to the best ones in hindsight, shown after every trade.
              </p>
            </Section>

            <Section title="Good reads by difficulty">
              {stats.difficulty.map((d) => (
                <ScoreRow
                  key={d.level}
                  name={d.level.charAt(0).toUpperCase() + d.level.slice(1)}
                  detail={d.cards ? `${d.goodReads}/${d.cards}` : 'none yet'}
                  share={d.cards ? d.goodReads / d.cards : null}
                />
              ))}
            </Section>

            <Section title="Patterns you miss most">
              {stats.patternsMissed.length === 0 ? (
                <p className="text-sm text-muted">After a few cards, the patterns you misread most often show up here.</p>
              ) : (
                stats.patternsMissed.slice(0, 5).map((p) => {
                  const inLibrary = findEntry(p.name)
                  return (
                    <ScoreRow
                      key={p.name}
                      name={p.name}
                      detail={`${p.correct}/${p.seen} correct`}
                      share={p.correct / p.seen}
                      onClick={inLibrary ? () => onLearn(p.name) : undefined}
                    />
                  )
                })
              )}
            </Section>

            <Section title="Practice">
              <ScoreRow
                name="Marking candles"
                detail={practice.mark.charts ? `${practice.mark.found}/${practice.mark.found + practice.mark.missed} found` : 'none yet'}
                share={practice.mark.charts ? practice.mark.found / Math.max(1, practice.mark.found + practice.mark.missed) : null}
              />
              <ScoreRow
                name="Candlesticks built"
                detail={`${practice.built.length}/${PRACTICE_CANDLES.length}`}
                share={practice.built.length / PRACTICE_CANDLES.length}
                progress
              />
              <ScoreRow
                name="Chart patterns drawn"
                detail={`${practice.drawn.length}/${DRAWABLE.length}`}
                share={practice.drawn.length / DRAWABLE.length}
                progress
              />
            </Section>
          </section>
        </div>

        <p className="mt-10 text-xs text-muted">
          Charts by{' '}
          <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="underline hover:text-soft">
            TradingView Lightweight Charts™
          </a>
        </p>
      </div>
    </div>
  )
}

function Tile({ label, value, note, tone = '' }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-edge bg-card px-4 py-4">
      <div className="text-[11px] tracking-[0.08em] text-muted uppercase">{label}</div>
      <div className={`mt-2 font-mono text-[28px] leading-none ${tone}`}>{value}</div>
      <div className="mt-2 text-[13px] text-muted">{note}</div>
    </div>
  )
}

function Small({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-2">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-[15px] ${tone}`}>{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-[13px] font-semibold tracking-[0.08em] text-muted uppercase">{title}</h2>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </div>
  )
}

// A name, a score, and a bar showing the share you got right. `progress`
// bars are always green: they count what's done, not how well.
function ScoreRow({ name, detail, share, onClick, progress }: { name: string; detail: string; share: number | null; onClick?: () => void; progress?: boolean }) {
  const content = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-[15px] ${onClick ? 'underline decoration-neutral-700 underline-offset-4' : ''}`}>{name}</span>
        <span className="font-mono text-[13px] text-muted">{detail}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-neutral-800">
        {share !== null && (progress ? share > 0 : true) && (
          <div className={`h-full rounded-full ${progress ? 'bg-up' : scoreColor(share)}`} style={{ width: `${Math.max(4, share * 100)}%` }} />
        )}
      </div>
    </>
  )
  return onClick ? (
    <button onClick={onClick} className="block w-full text-left" aria-label={`${name}: ${detail}. Open in Learn.`}>
      {content}
    </button>
  ) : (
    <div>{content}</div>
  )
}
