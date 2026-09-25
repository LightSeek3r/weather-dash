<script lang="ts">
  import { registerSW } from 'virtual:pwa-register'
  import { onMount, onDestroy } from 'svelte'
  import Layout from './components/Layout.svelte'
  import Background from './components/Background.svelte'
  import HeroClock from './components/HeroClock.svelte'
  import DateLine from './components/DateLine.svelte'
  import StatusPill from './components/StatusPill.svelte'
  import ToastStack from './components/ToastStack.svelte'
  import SettingsSheet from './components/SettingsSheet.svelte'
  import CurrentWeather from './components/CurrentWeather.svelte'
  import Timeline24h from './components/Timeline24h.svelte'
  import Tomorrow from './components/Tomorrow.svelte'
  import BorderFx from './components/BorderFx.svelte'
  import NightDim from './components/NightDim.svelte'
  import PixelShift from './components/PixelShift.svelte'
  import FullscreenScene from './components/FullscreenScene.svelte'
  import {
    startKiosk,
    watchVisibilityForWakeLock,
    acquireWakeLock
  } from './lib/core/fullscreen'
  import { subscribeOnlineStatus, getOnlineStatus } from './lib/ui/status'
  import { createIdleVisibility } from './lib/ui/idle-visibility'
  import { settingsStore } from './lib/core/storage/settings'
  import { t } from './lib/ui/strings'
  import { weatherStore, initWeather } from './lib/weather/store'
  import {
    scheduleNightlyReload,
    consumeNightlyReloadMarker
  } from './lib/core/nightly-reload'

  let s = $derived(t($settingsStore.locale))

  registerSW()

  // Fullscreen requires a user gesture on most browsers (and iOS Safari has
  // no Fullscreen API at all), so the dashboard starts behind a "tap to
  // start" overlay rather than requesting it unprompted on load — except
  // right after the nightly 03:30 reload (see lib/core/nightly-reload.ts):
  // that reload is not a real "someone walked up to the kiosk" moment, so
  // it skips the overlay and re-requests the wake lock immediately instead
  // of leaving the screen able to sleep until someone happens to tap it.
  let started = $state(consumeNightlyReloadMarker())
  let stopWatchingVisibility: (() => void) | undefined

  let online = $state(getOnlineStatus())
  let stopWatchingOnline: (() => void) | undefined

  // Real timestamp once initWeather() below has fetched at least once;
  // null (renders "no data yet") until the first fetch resolves — see
  // lib/weather/store.ts, which also keeps the last-good snapshot visible
  // through subsequent failures rather than clearing it.
  let lastUpdated = $derived($weatherStore.lastUpdated)

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
    const stopWeather = initWeather()
    const stopNightlyReload = scheduleNightlyReload('03:30')
    if (started) void acquireWakeLock()
    return () => {
      unsubscribe()
      stopWeather()
      stopNightlyReload()
    }
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
  {#snippet bg()}
    <Background />
  {/snippet}
  {#snippet hero()}
    <HeroClock />
    <DateLine />
    <StatusPill {lastUpdated} {online} />
  {/snippet}
  {#snippet cap()}
    <CurrentWeather />
  {/snippet}
  {#snippet tl()}
    <Timeline24h />
  {/snippet}
  {#snippet tm()}
    <Tomorrow />
  {/snippet}
</Layout>

<BorderFx />

<ToastStack />

<NightDim />
<PixelShift />
<FullscreenScene />

<button
  type="button"
  class="gear"
  class:gear--hidden={!gearVisible}
  aria-label={s.kiosk.openSettings}
  onclick={() => (settingsOpen = true)}
>
  ⚙
</button>

<SettingsSheet open={settingsOpen} onclose={() => (settingsOpen = false)} />

{#if !started}
  <button type="button" class="start-overlay" onclick={handleStart}>
    <span class="glass">{s.kiosk.tapToStart}</span>
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
