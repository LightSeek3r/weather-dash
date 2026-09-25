<script lang="ts">
  // Shell only — per-feature settings (weather units, holidays, photos, fx
  // quality, etc.) get their own section as each feature ships; this phase
  // just needs the open/close mechanics and a11y wiring in place so nothing
  // has to touch the sheet's container again.
  import { onDestroy } from 'svelte'
  import {
    settingsStore,
    PHOTO_ROTATION_VALUES
  } from '../lib/core/storage/settings'
  import type { Settings } from '../lib/core/storage/settings'
  import { t } from '../lib/ui/strings'
  import { geocode } from '../lib/weather/openMeteo'
  import type { GeocodeResult } from '../lib/weather/types'
  import {
    getSupportedCountries,
    getRegions,
    getYearHolidays
  } from '../lib/date/holidays'
  import type { SaintTradition } from '../lib/date/saints'
  import {
    listPhotos,
    addPhotos,
    removePhoto,
    getStorageEstimate,
    requestPersistentStorage
  } from '../lib/photos/store'
  import type { StorageEstimate } from '../lib/photos/store'
  import { notifyPhotosChanged } from '../lib/photos/notify'
  import type { StoredPhoto } from '../lib/photos/types'
  import { toast } from '../lib/ui/toast'

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
      location: { lat: result.lat, lon: result.lon, name: result.name },
      // Default holidays to the newly-picked location's country (plan
      // decision: "default = location's country+region"). This only runs
      // on an explicit new-location pick, never on a passive re-render, so
      // it can't fight a manual baseCountry change made after the fact.
      holidays: result.countryCode
        ? { ...current.holidays, baseCountry: result.countryCode }
        : current.holidays
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
        // No reverse geocoding in v1 (see comment above on
        // currentLocationName), so raw GPS coords carry no country code —
        // holidays.baseCountry can't be auto-set here and is left as-is;
        // the user can still pick it manually in the holidays section.
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

  // --- holidays: country/region + extra countries + per-holiday toggles ---
  const supportedCountries = getSupportedCountries()
  let extraCountryToAdd = $state('')
  let holidayYear = new Date().getFullYear()

  let baseCountry = $derived($settingsStore.holidays.baseCountry)
  let regionOptions = $derived(getRegions(baseCountry))
  let yearHolidays = $derived(
    getYearHolidays(
      holidayYear,
      baseCountry,
      $settingsStore.holidays.baseRegion,
      $settingsStore.locale
    )
  )
  // `date-holidays` can return two records sharing one rule (e.g. a
  // fixed-date holiday plus its weekend-observed substitute) — same id by
  // design (toggling disables both occurrences together, correctly, since
  // they're the same named holiday), but Svelte's keyed #each needs unique
  // keys, so the checklist itself is deduped by id for display.
  let dedupedYearHolidays = $derived.by(() => {
    const seen = new Set<string>()
    const out: typeof yearHolidays = []
    for (const holiday of yearHolidays) {
      if (seen.has(holiday.id)) continue
      seen.add(holiday.id)
      out.push(holiday)
    }
    return out
  })
  // Countries not already the base or an added extra — keeps the "add"
  // dropdown from offering a country that's already covered.
  let addableCountries = $derived(
    supportedCountries.filter(
      (c) =>
        c.code !== baseCountry &&
        !$settingsStore.holidays.extraCountries.includes(c.code)
    )
  )

  function setBaseCountry(code: string): void {
    settingsStore.update((current) => ({
      ...current,
      holidays: { ...current.holidays, baseCountry: code, baseRegion: null }
    }))
  }

  function setBaseRegion(code: string): void {
    settingsStore.update((current) => ({
      ...current,
      holidays: { ...current.holidays, baseRegion: code === '' ? null : code }
    }))
  }

  function addExtraCountry(): void {
    const code = extraCountryToAdd
    if (!code) return
    settingsStore.update((current) => ({
      ...current,
      holidays: {
        ...current.holidays,
        extraCountries: current.holidays.extraCountries.includes(code)
          ? current.holidays.extraCountries
          : [...current.holidays.extraCountries, code]
      }
    }))
    extraCountryToAdd = ''
  }

  function removeExtraCountry(code: string): void {
    settingsStore.update((current) => ({
      ...current,
      holidays: {
        ...current.holidays,
        extraCountries: current.holidays.extraCountries.filter(
          (c) => c !== code
        )
      }
    }))
  }

  function toggleHoliday(id: string, enabled: boolean): void {
    settingsStore.update((current) => {
      const disabled = new Set(current.holidays.disabledHolidayIds)
      if (enabled) disabled.delete(id)
      else disabled.add(id)
      return {
        ...current,
        holidays: { ...current.holidays, disabledHolidayIds: [...disabled] }
      }
    })
  }

  // --- saints: tradition + on/off toggle ---
  const traditionOptions: {
    value: SaintTradition
    labelKey: 'traditionRomanCatholic' | 'traditionFrenchCivil'
  }[] = [
    { value: 'roman-catholic', labelKey: 'traditionRomanCatholic' },
    { value: 'french-civil', labelKey: 'traditionFrenchCivil' }
  ]

  function setSaintsTradition(value: SaintTradition): void {
    settingsStore.update((current) => ({
      ...current,
      saints: { ...current.saints, tradition: value }
    }))
  }

  function setSaintsEnabled(enabled: boolean): void {
    settingsStore.update((current) => ({
      ...current,
      saints: { ...current.saints, enabled }
    }))
  }

  // --- photos: import/thumbnail grid/rotation/dim/blur/shuffle ---
  // deliberate: 2560 = plan's "resize to screen size" (largest realistic
  // kiosk display), not user-configurable — see the photos-section brief.
  const PHOTO_MAX_DIM = 2560

  let photoList = $state<StoredPhoto[]>([])
  let storageEstimate = $state<StorageEstimate | null>(null)
  let filePickerBusy = $state(false)
  let persistentStorageRequested = false

  // Thumbnail object URLs, keyed by photo id — plain (non-reactive) map so
  // repeated template reads of `thumbUrl()` don't recreate a URL every
  // render; only `refreshPhotos()` ever adds/revokes entries, same lifecycle
  // discipline as Background.svelte (plan premortem P2: no accumulating
  // object URLs).
  const thumbUrls = new Map<string, string>()

  function thumbUrl(photo: StoredPhoto): string {
    let url = thumbUrls.get(photo.id)
    if (!url) {
      url = URL.createObjectURL(photo.blob)
      thumbUrls.set(photo.id, url)
    }
    return url
  }

  function pruneThumbUrls(current: StoredPhoto[]): void {
    const liveIds = new Set(current.map((p) => p.id))
    for (const [id, url] of thumbUrls) {
      if (!liveIds.has(id)) {
        URL.revokeObjectURL(url)
        thumbUrls.delete(id)
      }
    }
  }

  async function refreshPhotos(): Promise<void> {
    const photos = await listPhotos()
    pruneThumbUrls(photos)
    photoList = photos
    storageEstimate = await getStorageEstimate()
  }

  async function handleFilesSelected(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement
    const files = input.files ? Array.from(input.files) : []
    input.value = ''
    if (files.length === 0) return

    filePickerBusy = true
    try {
      const { failed } = await addPhotos(files, PHOTO_MAX_DIM)
      for (const failure of failed) {
        toast.error(`${failure.file.name}: ${failure.error}`)
      }
      notifyPhotosChanged()
      await refreshPhotos()
    } finally {
      filePickerBusy = false
    }
  }

  async function handleDeletePhoto(id: string): Promise<void> {
    await removePhoto(id)
    const url = thumbUrls.get(id)
    if (url) {
      URL.revokeObjectURL(url)
      thumbUrls.delete(id)
    }
    notifyPhotosChanged()
    await refreshPhotos()
  }

  function setRotationDuration(
    value: Settings['photos']['rotationDuration']
  ): void {
    settingsStore.update((current) => ({
      ...current,
      photos: { ...current.photos, rotationDuration: value }
    }))
  }

  function setDimOpacity(value: number): void {
    settingsStore.update((current) => ({
      ...current,
      photos: { ...current.photos, dimOpacity: value }
    }))
  }

  function setBlurPx(value: number): void {
    settingsStore.update((current) => ({
      ...current,
      photos: { ...current.photos, blurPx: value }
    }))
  }

  function setShuffle(value: boolean): void {
    settingsStore.update((current) => ({
      ...current,
      photos: { ...current.photos, shuffle: value }
    }))
  }

  /** e.g. "5 minutes" / "1 hour" — composes from the dictionary's unit words rather than 10 fully separate translated phrases (see photos-section brief). */
  function rotationLabel(
    value: (typeof PHOTO_ROTATION_VALUES)[number]
  ): string {
    const n = parseInt(value, 10)
    const isHour = value.endsWith('h')
    const unit = isHour
      ? n === 1
        ? s.settings.photos.unitHour
        : s.settings.photos.unitHours
      : n === 1
        ? s.settings.photos.unitMinute
        : s.settings.photos.unitMinutes
    return s.settings.photos.duration(n, unit)
  }

  // Photo list/storage estimate load whenever the sheet opens (covers the
  // very first open and any later reopen); persistent-storage permission is
  // only ever requested once per session, fire-and-forget per the brief.
  $effect(() => {
    if (!open) return
    void refreshPhotos()
    if (!persistentStorageRequested) {
      persistentStorageRequested = true
      void requestPersistentStorage()
    }
  })

  onDestroy(() => {
    for (const url of thumbUrls.values()) URL.revokeObjectURL(url)
    thumbUrls.clear()
  })

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

      <section class="location-section">
        <h3>{s.settings.holidays.heading}</h3>

        <label class="field">
          <span>{s.settings.holidays.country}</span>
          <select
            value={baseCountry}
            onchange={(e) => setBaseCountry(e.currentTarget.value)}
          >
            {#each supportedCountries as country (country.code)}
              <option value={country.code}>{country.name}</option>
            {/each}
          </select>
        </label>

        {#if regionOptions.length > 0}
          <label class="field">
            <span>{s.settings.holidays.region}</span>
            <select
              value={$settingsStore.holidays.baseRegion ?? ''}
              onchange={(e) => setBaseRegion(e.currentTarget.value)}
            >
              <option value="">{s.settings.holidays.allRegions}</option>
              {#each regionOptions as region (region.code)}
                <option value={region.code}>{region.name}</option>
              {/each}
            </select>
          </label>
        {/if}

        <div class="field">
          <span>{s.settings.holidays.extraCountries}</span>
          <div class="location-search">
            <select bind:value={extraCountryToAdd}>
              <option value="" disabled>
                {s.settings.holidays.addCountry}
              </option>
              {#each addableCountries as country (country.code)}
                <option value={country.code}>{country.name}</option>
              {/each}
            </select>
            <button
              type="button"
              disabled={!extraCountryToAdd}
              onclick={addExtraCountry}
            >
              {s.settings.holidays.addCountry}
            </button>
          </div>
        </div>

        {#if $settingsStore.holidays.extraCountries.length > 0}
          <ul class="location-results chips">
            {#each $settingsStore.holidays.extraCountries as code (code)}
              <li>
                <span
                  >{supportedCountries.find((c) => c.code === code)?.name ??
                    code}</span
                >
                <button
                  type="button"
                  aria-label={s.settings.holidays.removeCountry}
                  onclick={() => removeExtraCountry(code)}
                >
                  ×
                </button>
              </li>
            {/each}
          </ul>
        {/if}

        <h4>{s.settings.holidays.listHeading}</h4>
        {#if dedupedYearHolidays.length > 0}
          <ul class="holiday-list">
            {#each dedupedYearHolidays as holiday (holiday.id)}
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={!$settingsStore.holidays.disabledHolidayIds.includes(
                      holiday.id
                    )}
                    onchange={(e) =>
                      toggleHoliday(holiday.id, e.currentTarget.checked)}
                  />
                  {holiday.name}
                </label>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="location-section">
        <h3>{s.settings.saints.heading}</h3>

        <label class="field checkbox-field">
          <input
            type="checkbox"
            checked={$settingsStore.saints.enabled}
            onchange={(e) => setSaintsEnabled(e.currentTarget.checked)}
          />
          {s.settings.saints.enable}
        </label>

        <label class="field">
          <span>{s.settings.saints.tradition}</span>
          <select
            value={$settingsStore.saints.tradition}
            onchange={(e) =>
              setSaintsTradition(e.currentTarget.value as SaintTradition)}
          >
            {#each traditionOptions as option (option.value)}
              <option value={option.value}
                >{s.settings.saints[option.labelKey]}</option
              >
            {/each}
          </select>
        </label>
      </section>

      <section class="location-section">
        <h3>{s.settings.photos.heading}</h3>

        <label class="field">
          <span>{s.settings.photos.addPhotos}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={filePickerBusy}
            onchange={(e) => void handleFilesSelected(e)}
          />
        </label>

        {#if photoList.length > 0}
          <ul class="photo-grid">
            {#each photoList as photo (photo.id)}
              <li class="photo-thumb">
                <img src={thumbUrl(photo)} alt="" />
                <button
                  type="button"
                  aria-label={s.settings.photos.deletePhoto}
                  onclick={() => void handleDeletePhoto(photo.id)}
                >
                  ×
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="sheet__placeholder">{s.settings.photos.empty}</p>
        {/if}

        <label class="field">
          <span>{s.settings.photos.rotation}</span>
          <select
            value={$settingsStore.photos.rotationDuration}
            onchange={(e) =>
              setRotationDuration(
                e.currentTarget.value as Settings['photos']['rotationDuration']
              )}
          >
            {#each PHOTO_ROTATION_VALUES as value (value)}
              <option {value}>{rotationLabel(value)}</option>
            {/each}
          </select>
        </label>

        <label class="field">
          <span>{s.settings.photos.dim}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={$settingsStore.photos.dimOpacity}
            oninput={(e) => setDimOpacity(Number(e.currentTarget.value))}
          />
        </label>

        <label class="field">
          <span>{s.settings.photos.blur}</span>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={$settingsStore.photos.blurPx}
            oninput={(e) => setBlurPx(Number(e.currentTarget.value))}
          />
        </label>

        <label class="field checkbox-field">
          <input
            type="checkbox"
            checked={$settingsStore.photos.shuffle}
            onchange={(e) => setShuffle(e.currentTarget.checked)}
          />
          {s.settings.photos.shuffle}
        </label>

        {#if storageEstimate}
          <p class="location-current">
            {s.settings.photos.storageUsage(
              Math.round(storageEstimate.usageMB),
              Math.round(storageEstimate.quotaMB)
            )}
          </p>
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

  .location-section h3 {
    margin: 0 0 0.75rem;
    font-family: var(--display, inherit);
    font-weight: 300;
    font-size: var(--font-size-md, 1.1rem);
  }

  .location-section h4 {
    margin: 1rem 0 0.5rem;
    font-weight: 600;
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--color-text-2, rgba(238, 244, 251, 0.7));
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: 0.75rem;
    font-size: var(--font-size-sm, 0.875rem);
  }

  .field select {
    padding: 0.5em 0.75em;
    border-radius: var(--radius-sm, 0.4rem);
    border: 1px solid var(--color-glass-edge, rgba(222, 238, 255, 0.18));
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text, #eef4fb);
    font-family: var(--font-body, sans-serif);
    font-size: var(--font-size-md, 1rem);
  }

  .field.checkbox-field {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  .location-results.chips li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.35em 0.75em;
    border-radius: var(--radius-sm, 0.4rem);
    background: var(--color-glass, rgba(196, 222, 255, 0.09));
  }

  .location-results.chips button {
    width: auto;
    padding: 0 0.4em;
    color: var(--color-text-2, rgba(238, 244, 251, 0.7));
    font-size: 1.1rem;
    line-height: 1;
  }

  .location-results.chips button:hover {
    color: var(--color-text, #eef4fb);
    background: transparent;
  }

  .holiday-list {
    list-style: none;
    margin: 0;
    padding: 0.25rem;
    max-height: 12rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    border: 1px solid var(--color-glass-edge, rgba(222, 238, 255, 0.18));
    border-radius: var(--radius-sm, 0.4rem);
  }

  .holiday-list label {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.35em 0.5em;
    font-size: var(--font-size-sm, 0.875rem);
    cursor: pointer;
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

  .field input[type='file'] {
    color: var(--color-text, #eef4fb);
    font-family: var(--font-body, sans-serif);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .field input[type='range'] {
    width: 100%;
    accent-color: var(--color-accent, #a6dcff);
  }

  .photo-grid {
    list-style: none;
    margin: 0.75rem 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
    gap: 0.5rem;
  }

  .photo-thumb {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--radius-sm, 0.4rem);
    overflow: hidden;
    background: var(--color-glass, rgba(196, 222, 255, 0.09));
  }

  .photo-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .photo-thumb button {
    position: absolute;
    top: 0.15rem;
    right: 0.15rem;
    width: 1.4rem;
    height: 1.4rem;
    line-height: 1;
    border: none;
    border-radius: var(--radius-full, 999px);
    background: rgb(10 23 38 / 0.65);
    color: var(--color-text, #eef4fb);
    cursor: pointer;
  }

  .photo-thumb button:hover,
  .photo-thumb button:focus-visible {
    background: rgb(10 23 38 / 0.85);
  }
</style>
