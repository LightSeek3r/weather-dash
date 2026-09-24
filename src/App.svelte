<script lang="ts">
  import { registerSW } from 'virtual:pwa-register'
  import { onMount, onDestroy } from 'svelte'
  import Layout from './components/Layout.svelte'
  import HeroClock from './components/HeroClock.svelte'
  import DateLine from './components/DateLine.svelte'
  import StatusPill from './components/StatusPill.svelte'
  import ToastStack from './components/ToastStack.svelte'
  import SettingsSheet from './components/SettingsSheet.svelte'
  import { startKiosk, watchVisibilityForWakeLock } from './lib/core/fullscreen'
  import { subscribeOnlineStatus, getOnlineStatus } from './lib/ui/status'
  import { createIdleVisibility } from './lib/ui/idle-visibility'

  registerSW()

  // Fullscreen requires a user gesture on most browsers (and iOS Safari has
  // no Fullscreen API at all), so the dashboard starts behind a "tap to
  // start" overlay rather than requesting it unprompted on load.
  let started = $state(false)
  let stopWatchingVisibility: (() => void) | undefined

  let online = $state(getOnlineStatus())
  let stopWatchingOnline: (() => void) | undefined

  // No weather fetch exists yet (phase 2) — the pill correctly shows
  // "no data yet" until then rather than a fake timestamp.
  const lastUpdated: Date | null = null

  // Gear fades in on any activity, hides after 5s idle (plan decision) —
  // keeps the screen free of always-visible chrome on a 24/7 wall display.
  const GEAR_IDLE_MS = 5000
  const idleVisibility = createIdleVisibility(GEAR_IDLE_MS)
  let gearVisible = $state(true)
  let settingsOpen = $state(false)

  onMount(() => {
    stopWatchingVisibility = watchVisibilityForWakeLock()
    stopWatchingOnline = subscribeOnlineStatus((next) => (online = next))
    const unsubscribe = idleVisibility.visible.subscribe(
      (v) => (gearVisible = v)
    )
    return unsubscribe
  })
  onDestroy(() => {
    stopWatchingVisibility?.()
    stopWatchingOnline?.()
    idleVisibility.destroy()
  })

  async function handleStart() {
    await startKiosk()
    started = true
  }
</script>

<Layout>
  {#snippet hero()}
    <HeroClock />
    <DateLine />
    <StatusPill {lastUpdated} {online} />
  {/snippet}
</Layout>

<ToastStack />

<button
  type="button"
  class="gear"
  class:gear--hidden={!gearVisible}
  aria-label="Open settings"
  onclick={() => (settingsOpen = true)}
>
  ⚙
</button>

<SettingsSheet open={settingsOpen} onclose={() => (settingsOpen = false)} />

{#if !started}
  <button type="button" class="start-overlay" onclick={handleStart}>
    <span class="glass">Tap to start</span>
  </button>
{/if}

<style>
  .start-overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: rgb(10 23 38 / 0.55);
    border: none;
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
  .start-overlay .glass {
    padding: 1em 1.6em;
    border-radius: var(--r);
    background: var(--glass);
    border: 1px solid var(--glass-edge);
    -webkit-backdrop-filter: blur(22px) saturate(1.25);
    backdrop-filter: blur(22px) saturate(1.25);
    font-family: var(--display);
    font-size: var(--fs-l);
    font-weight: 300;
  }
  .start-overlay:focus-visible {
    outline: 2px solid var(--ice);
    outline-offset: -2px;
  }

  .gear {
    position: fixed;
    right: var(--space-md, 1.5rem);
    bottom: var(--space-md, 1.5rem);
    z-index: 5;
    width: 2.75rem;
    height: 2.75rem;
    display: grid;
    place-items: center;
    border-radius: var(--radius-full, 999px);
    background: var(--color-glass, rgba(196, 222, 255, 0.09));
    border: 1px solid var(--color-glass-edge, rgba(222, 238, 255, 0.18));
    color: var(--color-text-2, rgba(238, 244, 251, 0.75));
    font-size: 1.3rem;
    cursor: pointer;
    backdrop-filter: blur(16px);
    transition:
      opacity 0.4s var(--ease-standard, ease),
      transform 0.4s var(--ease-standard, ease);
  }

  .gear--hidden {
    opacity: 0;
    transform: scale(0.9);
    /* still focusable via keyboard nav even while pointer-faded */
    pointer-events: none;
  }

  .gear:focus-visible {
    opacity: 1;
    transform: none;
    pointer-events: auto;
    outline: 2px solid var(--color-accent, #a6dcff);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .gear {
      transition: opacity 0.15s linear;
    }
  }
</style>
