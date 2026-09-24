import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { scheduler } from './lib/core/scheduler'

// Single app-wide tick source (see scheduler.ts) — started once here so the
// clock, date line, and every future minute/hour/midnight consumer share it.
scheduler.start()

// Svelte 5 dropped the `new Component(...)` client API in favor of `mount`.
const app = mount(App, {
  target: document.getElementById('app')!
})

export default app
