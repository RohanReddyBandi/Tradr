import { useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { lessonChart, EXIT_ROUNDS } from '../../lib/exits'
import type { LearnProgress } from '../../game/useLearn'
import { STARTING_BALANCE } from '../../game/useGame'
import { ExitsHero, RatioPlayground, SizeFromStop, TrapCard } from './ExitCharts'
import { ExitDrill } from './ExitDrill'
import { Bullets } from './Bullets'

interface Props {
  progress: LearnProgress['exits']
  onRoundDone: (score: number) => void
  onRunDone: (average: number) => void
  onBack: () => void
}

const STOP_POINTS = [
  'Decide it before you enter. It’s the price where your idea is proven wrong, not the point where the loss starts to hurt.',
  'Put it just past the last swing low for a buy (the last swing high for a sell), or past the support or resistance the trade leans on. If price gets through there, the setup is broken.',
  'Give it a little room: about a quarter of a normal day’s range beyond that swing, so an ordinary wiggle doesn’t knock you out.',
  'Never move it further away once you’re in. Moving it closer to lock in profit is fine.',
]

const TARGET_POINTS = [
  'Find the next obstacle: the nearest resistance above a buy, or support below a sell. That’s where price tends to stall.',
  'Set the take profit just short of it, so the order fills even if price turns a little early.',
  'For a chart pattern, its measured move (the pattern’s height, projected from the breakout) is another good guide.',
  'Check the payoff before you enter: the reward should be at least 1.5 to 2 times the risk. If the obstacle is too close for that, skip the trade.',
]

const scrollTop = () => requestAnimationFrame(() => document.getElementById('learn-scroll')?.scrollTo({ top: 0 }))

// Stop losses and take profits: where they go and why, the maths of risk
// and reward, the classic mistakes on real-looking charts, and a drill.
export function ExitsLesson({ progress, onRoundDone, onRunDone, onBack }: Props) {
  const [drilling, setDrilling] = useState(false)
  const good = useMemo(() => lessonChart('good'), [])
  const traps = useMemo(() => (['tight', 'greedy', 'wide'] as const).map((k) => lessonChart(k)), [])

  if (drilling) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-[26px] leading-tight font-bold tracking-tight">Stop loss & take profit</h2>
          <span className="text-[15px] text-muted">Place the exits</span>
        </div>
        <ExitDrill
          onRoundDone={onRoundDone}
          onRunDone={onRunDone}
          onExit={() => {
            setDrilling(false)
            scrollTop()
          }}
        />
      </motion.div>
    )
  }

  const best = progress.best
  return (
    <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <nav aria-label="Learn">
        <button type="button" onClick={onBack} className="-ml-1 flex h-11 items-center gap-1.5 px-1 text-[15px] text-muted hover:text-white">
          <span aria-hidden="true">←</span> All patterns
        </button>
      </nav>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">Risk management · Every trade</span>
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="min-w-0">
          <ExitsHero chart={good} height={400} />

          <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-neutral-100">
            Every trade needs two exits, planned before you enter: the <span className="text-down">stop loss</span>, where you admit you&rsquo;re wrong and
            take a small loss, and the <span className="text-up">take profit</span>, where you collect. Picking a pattern gets you into a trade; these decide what
            it&rsquo;s worth.
          </p>

          <Section title="Where the stop loss goes">
            <Bullets points={STOP_POINTS} />
          </Section>

          <Section title="Where the take profit goes">
            <Bullets points={TARGET_POINTS} />
          </Section>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <InfoCard title="Risk : reward">
              What you could make divided by what you could lose. At 1 : 2 a win pays twice what a loss costs, so you can be wrong more often than you&rsquo;re
              right and still come out ahead.
            </InfoCard>
            <InfoCard title="The trap" tone="amber">
              Moving your stop further away when the trade goes against you, to &ldquo;give it room&rdquo;. That&rsquo;s how a planned small loss turns into a
              big one.
            </InfoCard>
          </div>

          <Section title="Why the ratio matters">
            <p className="-mt-1 mb-3 text-[14px] text-muted">Pick a ratio, then slide how often you win. The line is 100 trades.</p>
            <RatioPlayground />
          </Section>

          <Section title="Size the trade from the stop">
            <p className="-mt-1 mb-3 text-[14px] text-muted">
              Most traders risk 1 to 2% of their balance on a trade. The stop tells you how many shares that buys. Using the chart above:
            </p>
            <SizeFromStop entry={good.plan.entry} stop={good.plan.stop} balance={STARTING_BALANCE} />
          </Section>

          <Section title="Where it goes wrong">
            <p className="-mt-1 mb-3 text-[14px] text-muted">The same mistakes, on real-looking charts. Dotted lines are the textbook stop and target.</p>
            <div className="flex flex-col gap-3">
              {traps.map((t) => (
                <TrapCard key={t.kind} chart={t} />
              ))}
            </div>
          </Section>
        </div>

        <aside className="mt-8 lg:mt-0">
          <div className="flex flex-col gap-3 lg:sticky lg:top-0">
            <div className={`rounded-3xl border p-5 ${best >= 0.8 ? 'border-up/30 bg-up/[0.05]' : 'border-edge bg-card'}`}>
              <div className="text-[11px] tracking-[0.08em] text-muted uppercase">Practice</div>
              <h3 className="mt-1.5 text-[19px] leading-snug font-semibold">Place the exits</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-soft">
                {EXIT_ROUNDS} setups where you know the direction. The stop loss and take profit start far out: drag them where they belong, then watch the next
                month play out.
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-neutral-800" aria-hidden="true">
                <div className={`h-full rounded-full ${best >= 0.8 ? 'bg-up' : 'bg-amber'}`} style={{ width: `${best * 100}%` }} />
              </div>
              <p className="mt-1.5 font-mono text-[12px] text-muted">
                {best > 0
                  ? `Best run ${Math.round(best * 100)}% · ${progress.played} charts placed`
                  : progress.played
                    ? `${progress.played} charts placed · finish ${EXIT_ROUNDS} in a row for a score`
                    : 'Not tried yet'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setDrilling(true)
                  scrollTop()
                }}
                className="mt-4 h-12 w-full rounded-2xl bg-up text-[16px] font-semibold text-black transition-colors hover:bg-[#5fe6ab]"
              >
                {progress.played ? 'Practice again' : 'Start practicing'}
              </button>
            </div>
            <div className="rounded-2xl border border-edge bg-card px-4 py-3 text-[14px] leading-relaxed text-soft">
              On the swipe cards, your stop loss and take profit start far out too, so the levels are always yours. The Breakdown grades them the same way.
            </div>
          </div>
        </aside>
      </div>
    </motion.article>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h3 className="mb-3 text-[13px] font-semibold tracking-[0.08em] text-muted uppercase">{title}</h3>
      {children}
    </section>
  )
}

function InfoCard({ title, tone, children }: { title: string; tone?: 'amber'; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${tone === 'amber' ? 'border-amber/25 bg-amber/[0.05]' : 'border-edge bg-card'}`}>
      <div className={`text-[11px] font-semibold tracking-[0.08em] uppercase ${tone === 'amber' ? 'text-amber' : 'text-muted'}`}>{title}</div>
      <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-100">{children}</p>
    </div>
  )
}
