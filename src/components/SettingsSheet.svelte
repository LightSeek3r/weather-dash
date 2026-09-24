<script lang="ts">
  // Shell only — per-feature settings (weather units, holidays, photos, fx
  // quality, etc.) get their own section as each feature ships; this phase
  // just needs the open/close mechanics and a11y wiring in place so nothing
  // has to touch the sheet's container again.
  import { onDestroy } from 'svelte'
  import { settingsStore } from '../lib/core/storage/settings'
  import { t } from '../lib/ui/strings'
  import { geocode } from '../lib/weather/openMeteo'
  import type { GeocodeResult } from '../lib/weather/types'

  interface Props {
    open: boolean
    onclose: () => void
  }

  let { open, onclose }: Props = $props()
  let closeButton: HTMLButtonElement | undefined = $state()
  let triggerToRestore: Element | null = null
  let s = $derived(t($settingsStore.locale))

  // --- location: city search + GPS (plan decision: "city search or GPS button") ---
  let query = $state('')
  let results = $state<GeocodeResult[]>([])
  let searching = $state(false)
  let gpsBusy = $state(false)
  let gpsError = $state<string | null>(null)

  async function runSearch(): Promise<void> {
    const trimmed = query.trim()
    if (!trimmed) return
    searching = true
    try {
      results = await geocode(trimmed)
    } catch (err) {
      // Network/HTTP failure — never crash the settings sheet over a lookup;
      // the existing location (if any) stays untouched, results just stay empty.
      results = []
      console.warn('[settings] location search failed', err)
    } finally {
      searching = false
    }
  }

  function selectLocation(result: GeocodeResult): void {
    settingsStore.update((current) => ({
      ...current,
      location: { lat: result.lat, lon: result.lon, name: result.name }
    }))
    results = []
    query = ''
  }

  function isGeolocationSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.geolocation
  }

  // Same capability-guarded, never-throwing shape as lib/core/fullscreen.ts —
  // a kiosk settings sheet must not break just because GPS is unavailable or denied.
  function useMyLocation(): void {
    gpsError = null
    if (!isGeolocationSupported()) {
      gpsError = s.weather.location.gpsUnavailable
      return
    }
    gpsBusy = true
    navigator.geolocation.getCurrentPosition(
      (position) => {
        gpsBusy = false
        settingsStore.update((current) => ({
          ...current,
          location: {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            name: s.weather.location.currentLocationName
          }
        }))
      },
      () => {
        gpsBusy = false
        gpsError = s.weather.location.gpsDenied
      }
    )
  }

  $effect(() => {
    if (open) {
      triggerToRestore = document.activeElement
      closeButton?.focus()
    } else if (triggerToRestore instanceof HTMLElement) {
      triggerToRestore.focus()
    }
  })

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onclose()
  }

  onDestroy(() => {
    if (triggerToRestore instanceof HTMLElement) triggerToRestore.focus()
  })
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
  <div
    class="sheet-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label={s.settings.title}
  >
    <div class="sheet">
      <header class="sheet__header">
        <h2>{s.settings.title}</h2>
        <button
          type="button"
          bind:this={closeButton}
          class="sheet__close"
          aria-label={s.settings.close}
          onclick={onclose}
        >
          ×
        </button>
      </header>
      <p class="sheet__placeholder">{s.settings.placeholder}</p>

      <section class="location-section">
        <form
          class="location-search"
          onsubmit={(e) => {
            e.preventDefault()
            void runSearch()
          }}
        >
          <input
            type="text"
            bind:value={query}
            placeholder={s.weather.location.searchPlaceholder}
            aria-label={s.weather.location.searchPlaceholder}
          />
          <button type="submit" disabled={searching || !query.trim()}>
            {s.weather.location.searchButton}
          </button>
        </form>

        {#if results.length > 0}
          <ul class="location-results">
            {#each results as result (`${result.lat},${result.lon}`)}
              <li>
                <button type="button" onclick={() => selectLocation(result)}>
                  {result.name}
                </button>
              </li>
            {/each}
          </ul>
        {/if}

        <button
          type="button"
          class="location-gps"
          disabled={gpsBusy}
          onclick={useMyLocation}
        >
          {s.weather.location.useMyLocation}
        </button>
        {#if gpsError}
          <p class="location-error">{gpsError}</p>
        {/if}

        {#if $settingsStore.location}
          <p class="location-current">{$settingsStore.location.name}</p>
        {/if}
      </section>

      <!-- Open-Meteo's forecast/geocoding/air-quality data is CC BY 4.0 —
           attribution required somewhere visible (plan premortem P10). No
           dedicated About screen exists yet, so it lives here. -->
      <p class="attribution">
        Weather data © <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noopener noreferrer">Open-Meteo.com</a
        > (CC BY 4.0)
      </p>
    </div>
  </div>
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    justify-content: flex-end;
    background: rgb(10 23 38 / 0.55);
  }

  .sheet {
    width: min(28rem, 100vw);
    height: 100%;
    padding: var(--space-md, 1.5rem);
    background: var(--color-glass, rgba(196, 222, 255, 0.09));
    border-inline-start: 1px solid
      var(--color-glass-edge, rgba(222, 238, 255, 0.18));
    backdrop-filter: blur(24px) saturate(1.25);
    -webkit-backdrop-filter: blur(24px) saturate(1.25);
    color: var(--color-text, #eef4fb);
    font-family: var(--font-body, sans-serif);
    overflow-y: auto;
  }

  .sheet__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md, 1.5rem);
  }

  .sheet__header h2 {
    margin: 0;
    font-family: var(--display, inherit);
    font-weight: 300;
  }

  .sheet__close {
    background: transparent;
    border: none;
    color: var(--color-text, #eef4fb);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.2em 0.5em;
    border-radius: var(--radius-sm, 0.4rem);
  }

  .sheet__close:hover,
  .sheet__close:focus-visible {
    background: var(--color-glass-hi, rgba(255, 255, 255, 0.1));
  }

  .sheet__placeholder {
    color: var(--color-text-2, rgba(238, 244, 251, 0.7));
    line-height: 1.5;
  }

  .location-section {
    margin-top: var(--space-md, 1.5rem);
    padding-top: var(--space-md, 1.5rem);
    border-top: 1px solid var(--color-glass-edge, rgba(222, 238, 255, 0.18));
  }

  .location-search {
    display: flex;
    gap: 0.5rem;
  }

  .location-search input {
    flex: 1;
    min-width: 0;
    padding: 0.5em 0.75em;
    border-radius: var(--radius-sm, 0.4rem);
    border: 1px solid var(--color-glass-edge, rgba(222, 238, 255, 0.18));
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text, #eef4fb);
    font-family: var(--font-body, sans-serif);
    font-size: var(--font-size-md, 1rem);
  }

  .location-search button,
  .location-gps {
    padding: 0.5em 0.9em;
    border-radius: var(--radius-sm, 0.4rem);
    border: 1px solid var(--color-glass-edge, rgba(222, 238, 255, 0.18));
    background: var(--color-glass, rgba(196, 222, 255, 0.09));
    color: var(--color-text, #eef4fb);
    font-family: var(--font-body, sans-serif);
    cursor: pointer;
  }

  .location-search button:disabled,
  .location-gps:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .location-search button:hover:not(:disabled),
  .location-gps:hover:not(:disabled) {
    background: var(--color-glass-hi, rgba(255, 255, 255, 0.1));
  }

  .location-results {
    list-style: none;
    margin: 0.75rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .location-results button {
    width: 100%;
    text-align: left;
    padding: 0.5em 0.75em;
    border: none;
    border-radius: var(--radius-sm, 0.4rem);
    background: transparent;
    color: var(--color-text, #eef4fb);
    font-family: var(--font-body, sans-serif);
    cursor: pointer;
  }

  .location-results button:hover,
  .location-results button:focus-visible {
    background: var(--color-glass-hi, rgba(255, 255, 255, 0.1));
  }

  .location-gps {
    display: block;
    margin-top: 0.75rem;
  }

  .location-error {
    margin-top: 0.5rem;
    color: var(--color-error, #ff9a86);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .location-current {
    margin-top: 0.5rem;
    color: var(--color-text-2, rgba(238, 244, 251, 0.7));
    font-size: var(--font-size-sm, 0.875rem);
  }

  .attribution {
    margin-top: var(--space-md, 1.5rem);
    padding-top: var(--space-md, 1.5rem);
    border-top: 1px solid var(--color-glass-edge, rgba(222, 238, 255, 0.18));
    color: var(--color-text-2, rgba(238, 244, 251, 0.6));
    font-size: var(--font-size-sm, 0.8rem);
  }

  .attribution a {
    color: inherit;
    text-decoration: underline;
  }
</style>
