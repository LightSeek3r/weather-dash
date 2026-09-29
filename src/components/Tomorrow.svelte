<script lang="ts">
  // Renders into Layout's `tm` slot (a low-height horizontal footer strip —
  // Layout.svelte's `.tm` already provides the flex row + gap, this only
  // supplies the child elements, matching design/mockups/02-blue-hour.html's
  // tomorrow strip).
  import { onMount } from 'svelte'
  import { weatherStore } from '../lib/weather/store'
  import { settingsStore } from '../lib/core/storage/settings'
  import { localeTag } from '../lib/ui/i18n'
  import { t } from '../lib/ui/strings'
  import { mapWmoCode } from '../lib/weather/mapWmo'
  import { beaufortForce } from '../lib/weather/beaufort'
  import { displayTemperature } from '../lib/weather/units'
  import { loadHolidays, type HolidaysModule } from '../lib/date/holidaysLazy'
  import InfoDisclosure from './InfoDisclosure.svelte'

  let s = $derived(t($settingsStore.locale))
  let unit = $derived($settingsStore.weather.tempUnit)
  let tomorrow = $derived($weatherStore.snapshot?.tomorrow ?? null)
  // Daily summaries have no isDay flag (they span the whole day) — always
  // render the daytime icon variant for the tomorrow strip.
  let visual = $derived(
    tomorrow ? mapWmoCode(tomorrow.weatherCode, true) : null
  )

  let dayFormatter = $derived(
    new Intl.DateTimeFormat(localeTag($settingsStore.locale), {
      weekday: 'short'
    })
  )
  // Shared by dayName below and the holiday lookup — both need "tomorrow" as
  // an actual Date, not the YYYY-MM-DD string the daily summary carries it as.
  let tomorrowDate = $derived(tomorrow ? new Date(tomorrow.date) : null)
  let dayName = $derived(tomorrowDate ? dayFormatter.format(tomorrowDate) : '')

  function rounded(celsius: number): number {
    return Math.round(displayTemperature(celsius, unit))
  }

  // See holidaysLazy.ts: DateLine.svelte already loads this module; the
  // promise cache means this call shares that one fetch, not a second one.
  let holidaysApi = $state<HolidaysModule | null>(null)
  onMount(() => {
    void loadHolidays().then((m) => {
      holidaysApi = m
    })
  })

  let tomorrowHolidays = $derived(
    holidaysApi && tomorrowDate
      ? holidaysApi.getHolidaysForDateAndSettings(
          tomorrowDate,
          $settingsStore.holidays,
          $settingsStore.locale
        )
      : []
  )
  // Same compact-with-overflow treatment as DateLine.svelte's holidayDisplay.
  let holidayDisplay = $derived.by(() => {
    const names = tomorrowHolidays.map((h) => h.name)
    if (names.length <= 2) return names.join(', ')
    return `${names.slice(0, 2).join(', ')} ${s.dateLine.more(names.length - 2)}`
  })
  let holidayOrigins = $derived(
    tomorrowHolidays.map((h) => {
      const country = holidaysApi
        ? holidaysApi.countryDisplayName(h.countryCode, $settingsStore.locale)
        : h.countryCode
      const region =
        h.regionCode && holidaysApi
          ? holidaysApi.regionDisplayName(
              h.countryCode,
              h.regionCode,
              $settingsStore.locale
            )
          : null
      return { name: h.name, origin: s.dateLine.holidayOrigin(country, region) }
    })
  )
</script>

{#if tomorrow && visual}
  <p class="lbl">{s.weather.panel.tomorrow} <span>{dayName}</span></p>
  <svg class="ic" aria-hidden="true"><use href="#{visual.icon}" /></svg>
  <p class="v">
    <b class="lo">{rounded(tomorrow.tempMin)}°</b>
    <b class="hi">{rounded(tomorrow.tempMax)}°</b>
  </p>
  <p class="v">
    <svg class="drop" aria-hidden="true"><use href="#i-drop" /></svg>
    <b>{tomorrow.precipitationProbability}%</b>
  </p>
  <p class="v">
    <b>{Math.round(tomorrow.windSpeedKmh)}</b> km/h · {s.weather.panel.force}
    {beaufortForce(tomorrow.windSpeedKmh)}
  </p>
  {#if tomorrowHolidays.length > 0}
    <p class="v holiday">
      <b>{holidayDisplay}</b>
      <InfoDisclosure label={s.common.moreInfo} placement="above" align="end">
        {#snippet trigger()}
          <svg class="info-icon" aria-hidden="true"><use href="#i-info" /></svg>
        {/snippet}
        {#snippet content()}
          {#each holidayOrigins as h (h.name)}
            <p>{h.name} — {h.origin}</p>
          {/each}
        {/snippet}
      </InfoDisclosure>
    </p>
  {/if}
{/if}

<style>
  /* No global paragraph-margin reset in this project (see src/app.css) —
     zero it here so the UA default 1em margin doesn't add unwanted height
     to Layout's low-height `.tm` footer row. */
  p {
    margin: 0;
  }

  .lbl {
    font-family: var(--display);
    font-weight: 400;
    font-size: var(--fs-l);
    color: var(--text);
  }
  .lbl span {
    color: var(--text-3);
    font-weight: 300;
  }
  .ic {
    width: calc(var(--u) * 3.4);
    height: calc(var(--u) * 3.4);
    flex: none;
  }
  .v {
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
    white-space: nowrap;
    font-size: var(--fs-m);
    color: var(--text-2);
  }
  .v b {
    font-family: var(--display);
    font-weight: 400;
    color: var(--text);
    font-size: 1.2em;
  }
  .v .hi {
    color: var(--peach);
  }
  .v .lo {
    color: var(--ice);
  }
  .v svg {
    width: 1em;
    height: 1em;
  }
  .drop {
    color: var(--rain);
  }
  .info-icon {
    width: 0.9em;
    height: 0.9em;
    opacity: 0.6;
  }
</style>
