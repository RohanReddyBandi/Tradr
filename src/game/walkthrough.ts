// Whether you've seen the first-run walkthrough, remembered in this browser.

const DONE_KEY = 'tradr:onboarded:v1'

export function walkthroughSeen() {
  try {
    return localStorage.getItem(DONE_KEY) === 'yes'
  } catch {
    return true // storage blocked: don't show it on every visit
  }
}

export function markWalkthroughSeen() {
  try {
    localStorage.setItem(DONE_KEY, 'yes')
  } catch {
    // Not saved: it may show again next time.
  }
}
