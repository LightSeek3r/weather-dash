<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import Layout from './components/Layout.svelte'
  import Background from './components/Background.svelte'
  import HeroClock from './components/HeroClock.svelte'
  import DateLine from './components/DateLine.svelte'
  import StatusPill from './components/StatusPill.svelte'
  import ToastStack from './components/ToastStack.svelte'
  import SettingsSheet from './components/SettingsSheet.svelte'
  import InstallPrompt from './components/InstallPrompt.svelte'
  import CurrentWeather from './components/CurrentWeather.svelte'
  import Timeline24h from './components/Timeline24h.svelte'
  import Tomorrow from './components/Tomorrow.svelte'
  import BorderFx from './components/BorderFx.svelte'
  import CelestialArc from './components/CelestialArc.svelte'
  import NightDim from './components/NightDim.svelte'
  import PixelShift from './components/PixelShift.svelte'
  import FullscreenScene from './components/FullscreenScene.svelte'
  import {
    startKiosk,
    watchVisibilityForWakeLock,
    acquireWakeLock,
    isStandalone,
    isFullscreen,
    isFullscreenSupported,
    watchFullscreen,
    enterFullscreen
  } from './lib/core/fullscreen'
  import { subscribeOnlineStatus, getOnlineStatus } from './lib/ui/status'
  import { createIdleVisibility } from './lib/ui/idle-visibility'
  import { settingsStore } from './lib/core/storage/settings'
  import { localeTag, textDirection } from './lib/ui/i18n'
  import { t } from './lib/ui/strings'
  import {
    weatherStore,
    initWeather,
    setDebugWeatherSnapshot
  } from './lib/weather/store'
  import { presentWeather } from './lib/weather/present'
  import { nameUnnamedLocation } from './lib/weather/locationName'
  import {
    buildDebugSnapshot,
    isDebugWeatherState,
    type DebugWeatherState
  } from './lib/weather/debug-snapshots'
  import { debugParams } from './lib/core/debug-params'
  import { mapWmoCode } from './lib/weather/mapWmo'
  import { initAppUpdate, applyAppUpdate } from './lib/core/app-update'
  import {
    scheduleNightlyReload,
    consumeNightlyReloadMarker
  } from './lib/core/nightly-reload'

  let s = $derived(t($settingsStore.locale))

  initAppUpdate()

  // Fullscreen requires a user gesture on most browsers (and iOS Safari has
  // no Fullscreen API at all), so the dashboard starts behind a "tap to
  // start" overlay rather than requesting it unprompted on load — except:
  // - right after the nightly 03:30 reload (see lib/core/nightly-reload.ts):
  //   that reload is not a real "someone walked up to the kiosk" moment, so
  //   it skips the overlay and re-requests the wake lock immediately instead
  //   of leaving the screen able to sleep until someone happens to tap it.
  // - launched from a home-screen install (`isStandalone()`): there's no
  //   browser chrome to request fullscreen for (and no user gesture to do
  //   it with, this early), so the overlay would be pure friction.
  // - fullscreen-on-start turned off in Settings: the dashboard opens in a
  //   normal window, and the button below offers fullscreen instead.
  let started = $state(
    consumeNightlyReloadMarker() ||
      isStandalone() ||
      !$settingsStore.fullscreenOnStart
  )
  let stopWatchingVisibility: (() => void) | undefined

  let online = $state(getOnlineStatus())
  let stopWatchingOnline: (() => void) | undefined

  // Offered whenever the app isn't fullscreen (opted out at start, or left
  // with Esc). Installed launches are already chromeless, and iPhone Safari
  // has no Fullscreen API, so neither gets a button that can't do anything.
  const canOfferFullscreen = isFullscreenSupported() && !isStandalone()
  let fullscreen = $state(isFullscreen())
  let showFullscreenButton = $derived(
    canOfferFullscreen && started && !fullscreen
  )
  // Layout.svelte widens the Tomorrow row's right clearance while it's shown.
  $effect(() => {
    const root = document.documentElement
    if (showFullscreenButton) root.dataset.fsButton = ''
    else delete root.dataset.fsButton
  })

  // `<html lang>` was static markup before Arabic/Urdu existed as options —
  // screen readers and the browser's own script/font selection need it to
  // track the chosen locale. `dir` flips the two RTL locales; the grid layout
  // itself (clock/weather/timeline placement) stays put rather than
  // mirroring — `dir="rtl"` still right-aligns and correctly shapes the
  // translated text itself, which is the part that actually needs it.
  $effect(() => {
    const root = document.documentElement
    root.lang = localeTag($settingsStore.locale)
    root.dir = textDirection($settingsStore.locale)
  })

  // Real timestamp once initWeather() below has fetched at least once;
  // null (renders "no data yet") until the first fetch resolves — see
  // lib/weather/store.ts, which also keeps the last-good snapshot visible
  // through subsequent failures rather than clearing it.
  let lastUpdated = $derived($weatherStore.lastUpdated)

  // Sky mood for the [data-sky] token overrides in design-tokens.css: sunlit
  // daytime and fog get one; everything else keeps the default sky, which
  // already suits night, rain and snow.
  let skyMood = $derived.by(() => {
    const c = $presentWeather?.current
    if (!c) return null
    const key = mapWmoCode(c.weatherCode, c.isDay).conditionKey
    if (key === 'fog') return 'fog' // a pale wash behind the glass, day or night
    if (!c.isDay) return null
    if (key === 'clearSky' || key === 'mainlyClear') return 'sunny'
    if (key === 'partlyCloudy') return 'partly'
    return null
  })
  $effect(() => {
    const root = document.documentElement
    if (skyMood) root.dataset.sky = skyMood
    else delete root.dataset.sky
  })

  // Gear fades in on any activity, hides after 5s idle (plan decision) —
  // keeps the screen free of always-visible chrome on a 24/7 wall display.
  const GEAR_IDLE_MS = 5000
  const idleVisibility = createIdleVisibility(GEAR_IDLE_MS)
  let gearVisible = $state(true)
  let settingsOpen = $state(false)

  // First run with no location set yet: open Settings straight to the field
  // that matters, instead of leaving the dashboard sitting on "Set a
  // location to see the weather" until someone happens to find the gear.
  let autoOpenedSettings = false
  function maybeAutoOpenSettings(): void {
    if (autoOpenedSettings || $settingsStore.location) return
    autoOpenedSettings = true
    settingsOpen = true
  }

  const DEBUG_FALLBACK_LOCATION = {
    lat: 50.85,
    lon: 4.35,
    name: 'Brussels',
    timezone: 'Europe/Brussels'
  }

  /**
   * `?weather=<state>` (see lib/core/debug-params.ts) substitutes a canned
   * snapshot for a real fetch — dev/test only, and never combined with
   * initWeather() (see setDebugWeatherSnapshot's doc in weather/store.ts).
   * Returns a no-op cleanup so the caller can treat it the same as
   * initWeather()'s real unsubscribe function.
   */
  function startDebugWeather(state: DebugWeatherState): () => void {
    const location = $settingsStore.location
      ? {
          ...$settingsStore.location,
          timezone: DEBUG_FALLBACK_LOCATION.timezone
        }
      : DEBUG_FALLBACK_LOCATION
    setDebugWeatherSnapshot(
      buildDebugSnapshot(state, debugParams.now ?? new Date(), location)
    )
    return () => {}
  }

  onMount(() => {
    stopWatchingVisibility = watchVisibilityForWakeLock()
    stopWatchingOnline = subscribeOnlineStatus((next) => (online = next))
    const stopWatchingFullscreen = watchFullscreen((on) => (fullscreen = on))
    const unsubscribe = idleVisibility.visible.subscribe(
      (v) => (gearVisible = v)
    )
    const debugWeather = debugParams.weather
    const stopWeather =
      debugWeather && isDebugWeatherState(debugWeather)
        ? startDebugWeather(debugWeather)
        : initWeather()
    // GPS fixes saved before reverse geocoding existed are still unnamed.
    if (!debugWeather) void nameUnnamedLocation(false)
    const stopNightlyReload = scheduleNightlyReload('03:30', applyAppUpdate)
    if (started) {
      void acquireWakeLock()
      maybeAutoOpenSettings()
    }
    return () => {
      unsubscribe()
      stopWatchingFullscreen()
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
    maybeAutoOpenSettings()
  }

  // Same as handleStart but skips enterFullscreen() — for anyone who taps
  // the dismiss button rather than the overlay itself. Still acquires the
  // wake lock, matching the fullscreenOnStart-off skip path in onMount
  // above: declining fullscreen isn't declining "stay awake".
  async function handleDismiss() {
    await acquireWakeLock()
    started = true
    maybeAutoOpenSettings()
  }
</script>

<Layout>
  {#snippet bg()}
    <Background />
  {/snippet}
  {#snippet sky()}
    <CelestialArc />
  {/snippet}
  {#snippet hero()}
    <HeroClock />
    <DateLine />
  {/snippet}
  {#snippet cap()}
    <CurrentWeather />
  {/snippet}
  {#snippet tl()}
    <Timeline24h />
  {/snippet}
  {#snippet tm()}
    <Tomorrow />
    <StatusPill {lastUpdated} {online} />
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
  data-fx-calm
  class:gear--hidden={!gearVisible}
  aria-label={s.kiosk.openSettings}
  onclick={() => (settingsOpen = true)}
>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path
      d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
    />
    <circle cx="12" cy="12" r="3" />
  </svg>
</button>

{#if showFullscreenButton}
  <button
    type="button"
    class="gear gear--fullscreen"
    data-fx-calm
    class:gear--hidden={!gearVisible}
    aria-label={s.kiosk.enterFullscreen}
    onclick={() => void enterFullscreen()}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  </button>
{/if}

<SettingsSheet open={settingsOpen} onclose={() => (settingsOpen = false)} />

<!-- Held back behind the start overlay, the settings sheet and fullscreen: a wall display
     that is already running has no use for an install nag. -->
<InstallPrompt suppressed={!started || fullscreen || settingsOpen} />

{#if !started}
  <div class="start-overlay">
    <button
      type="button"
      class="start-overlay__trigger"
      aria-labelledby="start-overlay-message"
      onclick={handleStart}
    ></button>
    <!-- Visual only: taps on the card fall through to the trigger beneath,
         except on the X, which re-enables pointer events for itself. -->
    <div class="start-overlay__card">
      <p id="start-overlay-message">
        {s.kiosk.tapToStart}
        <small>{s.kiosk.installTip}</small>
      </p>
      <button
        type="button"
        class="start-overlay__dismiss"
        aria-label={s.kiosk.dismiss}
        onclick={handleDismiss}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .start-overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
    background: rgb(10 23 38 / 0.55);
    color: var(--text);
  }
  .start-overlay__trigger {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: none;
    background: none;
    cursor: pointer;
  }
  .start-overlay__trigger:focus-visible {
    outline: 2px solid var(--ice);
    outline-offset: -2px;
  }
  .start-overlay__card {
    position: relative;
    pointer-events: none;
    margin: var(--pad);
    padding: 1em 2.6em;
    border-radius: var(--r);
    background: var(--glass);
    border: 1px solid var(--glass-edge);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(1.25)
      brightness(var(--glass-dim));
    backdrop-filter: blur(var(--glass-blur)) saturate(1.25)
      brightness(var(--glass-dim));
    font-family: var(--display);
    font-size: max(20px, var(--fs-l));
    font-weight: 300;
  }
  .start-overlay__card p {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5em;
    text-align: center;
  }
  .start-overlay__card small {
    font-size: var(--fs-s);
    font-weight: 400;
    color: var(--text-2);
  }
  .start-overlay__dismiss {
    position: absolute;
    top: 0.35rem;
    inset-inline-end: 0.35rem;
    pointer-events: auto;
    width: 2.75rem;
    height: 2.75rem;
    display: grid;
    place-items: center;
    border-radius: var(--radius-full, 999px);
    background: none;
    border: none;
    color: var(--text-2);
    padding: 0;
    cursor: pointer;
  }
  .start-overlay__dismiss:hover {
    color: var(--text);
    background: var(--glass-hi);
  }
  .start-overlay__dismiss svg {
    width: 1.25rem;
    height: 1.25rem;
  }
  .start-overlay__dismiss:focus-visible {
    outline: 2px solid var(--ice);
    outline-offset: -2px;
  }

  /* StatusPill.svelte now pins its status dot to this same bottom-right
     corner (right: var(--space-md), same z-index) — shifted one 3.25rem
     slot further out so the dot claims the actual corner instead of being
     covered by it. */
  .gear {
    position: fixed;
    right: calc(var(--space-md, 1.5rem) + 3.25rem);
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
    padding: 0;
    cursor: pointer;
    backdrop-filter: blur(calc(var(--glass-blur) * 0.8));
    transition:
      opacity 0.4s var(--ease-standard, ease),
      transform 0.4s var(--ease-standard, ease);
  }

  .gear--fullscreen {
    right: calc(var(--space-md, 1.5rem) + 6.5rem);
  }

  .gear svg {
    width: 1.4rem;
    height: 1.4rem;
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
