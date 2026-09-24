<script lang="ts">
  // Renders into Layout's `tm` slot (a low-height horizontal footer strip —
  // Layout.svelte's `.tm` already provides the flex row + gap, this only
  // supplies the child elements, matching design/mockups/02-blue-hour.html's
  // tomorrow strip).
  import { weatherStore } from '../lib/weather/store'
  import { settingsStore } from '../lib/core/storage/settings'
  import { localeTag } from '../lib/ui/i18n'
  import { t } from '../lib/ui/strings'
  import { mapWmoCode } from '../lib/weather/mapWmo'
  import { beaufortForce } from '../lib/weather/beaufort'
  import { displayTemperature } from '../lib/weather/units'

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
  let dayName = $derived(
    tomorrow ? dayFormatter.format(new Date(tomorrow.date)) : ''
  )

  function rounded(celsius: number): number {
    return Math.round(displayTemperature(celsius, unit))
  }
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
</style>
