import { Component, type ReactNode } from 'react'

interface State {
  failed: boolean
  confirming: boolean
}

// If something breaks while drawing the app, show a way out instead of a
// blank screen: reload, or (if the saved data itself is the problem) clear it.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, confirming: false }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  clearSaved() {
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith('tradr:')) localStorage.removeItem(key)
    } catch {
      // Storage is blocked: a reload is all we can do.
    }
    location.reload()
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="mx-auto flex h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="text-[24px] font-bold tracking-tight">Something went wrong</h1>
        <p className="text-[15px] leading-relaxed text-soft">Tradr hit an error it couldn&rsquo;t recover from. Reloading usually fixes it.</p>
        <button type="button" onClick={() => location.reload()} className="h-12 rounded-2xl bg-up text-[16px] font-semibold text-black">
          Reload
        </button>
        {this.state.confirming ? (
          <button
            type="button"
            onClick={() => this.clearSaved()}
            className="h-12 rounded-2xl border border-down/40 bg-down/10 text-[15px] font-medium text-down"
          >
            Yes, clear my balance, history and progress
          </button>
        ) : (
          <button type="button" onClick={() => this.setState({ confirming: true })} className="h-11 text-[14px] text-muted hover:text-white">
            Still broken? Clear saved data
          </button>
        )}
      </main>
    )
  }
}
