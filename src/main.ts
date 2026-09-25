import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { scheduler } from './lib/core/scheduler'
import { debugParams } from './lib/core/debug-params'

// Single app-wide tick source (see scheduler.ts) — started once here so the
// clock, date line, and every future minute/hour/midnight consumer share it.
// Skipped under `?freeze=1`/`?now=` (see lib/core/debug-params.ts): every
// scheduler-driven "now" in the app is seeded once from `debugParams.now` at
// its own mount and then never advances, which is what a deterministic
// screenshot needs (plan premortem P8).
if (!debugParams.freeze) {
  scheduler.start()
}

// Global CSS kill-switch for the same deterministic-screenshot goal — see
// app.css's `html.debug-freeze` rule. Safe to leave enabled for the rest of
// the page's life: nothing in the app depends on a `transitionend`/
// `animationend` event to fire (Background.svelte's own crossfade cleanup
// uses a `setTimeout`, not a transition listener — checked).
if (debugParams.freeze && typeof document !== 'undefined') {
  document.documentElement.classList.add('debug-freeze')
}

// Svelte 5 dropped the `new Component(...)` client API in favor of `mount`.
const app = mount(App, {
  target: document.getElementById('app')!
})

export default app
