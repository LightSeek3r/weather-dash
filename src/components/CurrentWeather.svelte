<script lang="ts">
  // Renders into Layout's `cap` slot (the glass panel is Layout's — this
  // only fills its content, matching design/mockups/02-blue-hour.html's
  // .cap-now / .cap-cond / .reads structure).
  import { weatherStore } from '../lib/weather/store'
  import { settingsStore } from '../lib/core/storage/settings'
  import { localeTag } from '../lib/ui/i18n'
  import { conditionLabel, t } from '../lib/ui/strings'
  import { mapWmoCode } from '../lib/weather/mapWmo'
  import { beaufortForce } from '../lib/weather/beaufort'
  import { displayTemperature } from '../lib/weather/units'
  import { compassDirection } from '../lib/weather/wind'
  import { illuminationPercent, daysUntilPhase } from '../lib/weather/moon'
  import { remainingDayRange } from '../lib/weather/todayRange'
  import { europeanAqiBand } from '../lib/weather/aqi'
  import type { MoonPhaseKey } from '../lib/weather/types'
  import WeatherIconSprite from './WeatherIconSprite.svelte'
  import InfoDisclosure from './InfoDisclosure.svelte'
  import { fitHeight } from '../lib/ui/fit-height'

  // Decorative + always paired with the translated phase name below, not an
  // icon-only control — the phase's actual shape (crescent/gibbous/etc.) is
  // real information a generic dot/circle icon wouldn't convey as directly.
  const MOON_GLYPH: Record<MoonPhaseKey, string> = {
    newMoon: '🌑',
    waxingCrescent: '🌒',
    firstQuarter: '🌓',
    waxingGibbous: '🌔',
    fullMoon: '🌕',
    waningGibbous: '🌖',
    lastQuarter: '🌗',
    waningCrescent: '🌘'
  }

  let s = $derived(t($settingsStore.locale))
  let unit = $derived($settingsStore.weather.tempUnit)
  let snapshot = $derived($weatherStore.snapshot)
  let current = $derived(snapshot?.current ?? null)
  let visual = $derived(
    current ? mapWmoCode(current.weatherCode, current.isDay) : null
  )

  function roundedTemp(celsius: number): number {
    return Math.round(displayTemperature(celsius, unit))
  }

  let conditionText = $derived(visual ? conditionLabel(s.weather, visual) : '')

  let range = $derived(snapshot ? remainingDayRange(snapshot) : null)
  let rangeLabel = $derived(
    range
      ? s.weather.panel.todayRange(
          `${roundedTemp(range.min)}°`,
          `${roundedTemp(range.max)}°`
        )
      : ''
  )
  let aqi = $derived(snapshot?.airQuality?.europeanAqi ?? null)
  let aqiBand = $derived(aqi === null ? null : europeanAqiBand(aqi))

  let timeFormatter = $derived(
    new Intl.DateTimeFormat(localeTag($settingsStore.locale), {
      hour: '2-digit',
      minute: '2-digit'
    })
  )
  let sunrise = $derived(
    snapshot ? timeFormatter.format(new Date(snapshot.today.sunrise)) : ''
  )
  let sunset = $derived(
    snapshot ? timeFormatter.format(new Date(snapshot.today.sunset)) : ''
  )
  let daylightDuration = $derived.by(() => {
    if (!snapshot) return ''
    const ms =
      new Date(snapshot.today.sunset).getTime() -
      new Date(snapshot.today.sunrise).getTime()
    const totalMin = Math.max(0, Math.round(ms / 60000))
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return `${h}h ${m}m`
  })
  let moonGlyph = $derived(snapshot ? MOON_GLYPH[snapshot.moon.labelKey] : '')
  let moonLabel = $derived(
    snapshot ? s.weather.moonPhase[snapshot.moon.labelKey] : ''
  )
  let moonIllumination = $derived(
    snapshot ? illuminationPercent(snapshot.moon.fraction) : 0
  )
  let daysToFullMoon = $derived(
    snapshot ? Math.round(daysUntilPhase(snapshot.moon.fraction, 0.5)) : 0
  )
  let daysToNewMoon = $derived(
    snapshot ? Math.round(daysUntilPhase(snapshot.moon.fraction, 0)) : 0
  )
</script>

<WeatherIconSprite />

{#if !current || !visual}
  <p class="no-location">{s.weather.panel.noLocation}</p>
{:else}
  <div
    class="weather-panel"
    use:fitHeight={{ target: '.cap-now', prop: '--temp-fit' }}
  >
    <div class="cap-now">
      <div class="temp-row">
        <p class="temp">
          {roundedTemp(current.temperature)}<sup>°{unit}</sup>
        </p>
        {#if range}
          <p class="range" title={rangeLabel}>
            <span class="sr-only">{rangeLabel}</span>
            <span class="hi" aria-hidden="true">↑{roundedTemp(range.max)}°</span
            >
            <span class="lo" aria-hidden="true">↓{roundedTemp(range.min)}°</span
            >
          </p>
        {/if}
      </div>
      <svg class="hero-icon" aria-hidden="true">
        <use href="#{visual.icon}" />
      </svg>
    </div>
    <div class="cap-cond">
      <div>
        <p class="cond">{conditionText}</p>
        <div class="cond-meta">
          <p class="rain">
            <svg class="ic-inline" aria-hidden="true"
              ><use href="#i-drop" /></svg
            >
            {current.precipitationProbability}% · {current.precipitationMm} mm
          </p>
          {#if aqi !== null && aqiBand}
            <InfoDisclosure
              label={s.weather.panel.airQuality}
              placement="above"
            >
              {#snippet trigger()}
                <p class="aqi" title={s.weather.panel.airQuality}>
                  <svg class="aqi-ic aqi--{aqiBand}" aria-hidden="true"
                    ><use href="#i-air" /></svg
                  ><span class="sr-only">{s.weather.panel.airQuality}</span>
                  <b>{s.weather.panel.aqiBand[aqiBand]}</b><span
                    class="aqi-value">{Math.round(aqi)}</span
                  >
                </p>
              {/snippet}
              {#snippet content()}
                <p>{s.weather.panel.aqiScaleInfo}</p>
              {/snippet}
            </InfoDisclosure>
          {/if}
        </div>
      </div>
      <InfoDisclosure
        label={s.weather.panel.moonPhase}
        placement="above"
        align="end"
      >
        {#snippet trigger()}
          <p class="moon">
            <span class="moon-glyph" aria-hidden="true">{moonGlyph}</span><span
              class="moon-label">{moonLabel}</span
            >
          </p>
        {/snippet}
        {#snippet content()}
          <p class="moon-detail">
            {s.weather.panel.moonIllumination(moonIllumination)}
          </p>
          <p class="moon-detail">
            {s.weather.panel.moonNextFull(daysToFullMoon)}
          </p>
          <p class="moon-detail">
            {s.weather.panel.moonNextNew(daysToNewMoon)}
          </p>
        {/snippet}
      </InfoDisclosure>
    </div>
    <div class="reads">
      <p class="read">
        <small>{s.weather.panel.feelsLike}</small><b
          >{roundedTemp(current.feelsLike)}°</b
        >
      </p>
      <p class="read">
        <small>{s.weather.panel.humidity}</small><b>{current.humidity}</b><span
          class="q">%</span
        >
      </p>
      <p class="read">
        <small>
          <InfoDisclosure label={s.weather.panel.uvIndex} align="end">
            {#snippet trigger()}{s.weather.panel.uvIndex}{/snippet}
            {#snippet content()}
              <p>{s.weather.panel.uvScaleInfo}</p>
            {/snippet}
          </InfoDisclosure>
        </small><b>{Math.round(current.uvIndex)}</b><span class="q">/11+</span>
      </p>
      <div class="read wind">
        <svg class="dial" viewBox="0 0 48 48" aria-hidden="true">
          <circle
            cx="24"
            cy="24"
            r="21"
            fill="none"
            stroke="rgb(222 238 255 / 0.22)"
            stroke-width="1.5"
          />
          <text
            x="24"
            y="16"
            text-anchor="middle"
            font-size="7"
            fill="var(--text-3)">N</text
          >
          <g
            style="rotate:{current.windDirectionDeg}deg;transform-origin:24px 24px"
          >
            <path d="M24 11l6 18-6-4-6 4z" fill="var(--ice)" />
          </g>
        </svg>
        <div>
          <small>
            <InfoDisclosure label={s.weather.panel.wind} placement="above">
              {#snippet trigger()}
                {s.weather.panel.wind} · {s.weather.panel.force}
                {beaufortForce(current.windSpeedKmh)}/12
              {/snippet}
              {#snippet content()}
                <p>{s.weather.panel.windScaleInfo}</p>
              {/snippet}
            </InfoDisclosure>
          </small>
          <b>{Math.round(current.windSpeedKmh)}</b>
          <span class="q"
            >km/h {compassDirection(current.windDirectionDeg)} · {s.weather
              .panel.gusts}
            {Math.round(current.windGustsKmh)}</span
          >
        </div>
      </div>
      <div class="read sun">
        <small class="sr-only"
          >{s.weather.panel.sunrise} / {s.weather.panel.sunset}</small
        >
        <b><svg aria-hidden="true"><use href="#i-rise" /></svg>{sunrise}</b>
        <b><svg aria-hidden="true"><use href="#i-set" /></svg>{sunset}</b>
        <span class="q daylight" title={s.weather.panel.daylight}
          ><span class="sr-only">{s.weather.panel.daylight}</span
          >{daylightDuration}</span
        >
      </div>
    </div>
  </div>
{/if}

<style>
  /* This component's own <p> tags (temp/cond/rain/read/no-location) need
     resetting — the project has no global paragraph-margin reset (see
     src/app.css), and the UA default 1em margin explodes at --fs-temp's
     size, silently inflating the panel's grid rows far past their content. */
  p {
    margin: 0;
  }

  .no-location {
    color: var(--text-2);
    font-size: var(--fs-m);
  }

  .weather-panel {
    display: grid;
    grid-template-rows: auto auto 1fr;
    gap: calc(var(--u) * 1.4);
    height: 100%;
    min-height: 0;
  }

  .cap-now {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--u) * 1);
  }
  .temp {
    font-family: var(--display);
    /* --temp-fit: set on .weather-panel by lib/ui/fit-height.ts. */
    font-size: calc(var(--fs-temp) * var(--temp-fit, 1));
    font-weight: 200;
    line-height: 0.9;
    letter-spacing: -0.04em;
  }
  .temp sup {
    font-size: 0.36em;
    font-weight: 300;
    vertical-align: 1.2em;
    color: var(--text-2);
    margin-left: 0.06em;
  }
  .hero-icon {
    width: calc(var(--u) * 8.5 * var(--temp-fit, 1));
    height: calc(var(--u) * 8.5 * var(--temp-fit, 1));
    flex: none;
  }

  .temp-row {
    display: flex;
    align-items: center;
    gap: calc(var(--u) * 1.2);
  }
  .range {
    display: flex;
    flex-direction: column;
    gap: 0.2em;
    font-family: var(--display);
    font-size: var(--fs-m);
    line-height: 1.1;
    white-space: nowrap;
  }
  .range .hi {
    color: var(--peach);
  }
  .range .lo {
    color: var(--ice);
  }

  .cond {
    font-family: var(--display);
    font-size: var(--fs-l);
    font-weight: 400;
    line-height: 1.15;
  }
  .cond-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: calc(var(--u) * 0.3) calc(var(--u) * 1.4);
    margin-top: calc(var(--u) * 0.5);
  }
  .rain {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    color: var(--text-2);
    font-size: var(--fs-s);
  }
  .ic-inline {
    width: 1em;
    height: 1em;
    color: var(--rain);
  }

  .reads {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: calc(var(--u) * 0.8);
    align-content: end;
  }
  .read {
    padding: calc(var(--u) * 0.9) calc(var(--u) * 1);
    border-radius: calc(var(--r) * 0.55);
    background: rgb(196 222 255 / 0.05);
    min-width: 0;
  }
  .read small {
    display: block;
    font-size: var(--fs-xs);
    color: var(--text-3);
  }
  .read b {
    font-family: var(--display);
    font-weight: 300;
    font-size: calc(var(--u) * 2.2);
    line-height: 1.15;
    white-space: nowrap;
  }
  .read .q {
    font-size: var(--fs-s);
    color: var(--text-2);
  }
  .read.wind {
    grid-column: span 2;
    display: flex;
    align-items: center;
    gap: calc(var(--u) * 1);
  }
  .dial {
    width: calc(var(--u) * 4.4);
    height: calc(var(--u) * 4.4);
    flex: none;
  }
  .read.sun b {
    font-size: calc(var(--u) * 1.7);
    display: flex;
    align-items: center;
    gap: 0.3em;
  }
  .read.sun svg {
    width: 1em;
    height: 1em;
    color: var(--peach);
  }
  /* Daylight and moon live in existing free space, not a new grid row or
     line — the `cap` card is fixed-height (Layout.svelte), and extra rows
     were clipped off its bottom, while a daylight+moon line overflowed the
     narrow sun card sideways. */
  .daylight {
    display: block;
    margin-top: 0.3em;
    white-space: nowrap;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .cap-cond {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: calc(var(--u) * 0.6) calc(var(--u) * 1.5);
  }
  .moon {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    color: var(--text-2);
    font-size: var(--fs-s);
    white-space: nowrap;
  }
  .moon-glyph {
    font-size: 1.3em;
    line-height: 1;
  }
  .aqi {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    min-width: 0;
    color: var(--text-3);
    font-size: var(--fs-s);
  }
  .aqi b {
    color: var(--text);
    font-weight: 400;
  }
  .aqi-value {
    color: var(--text-2);
  }
  .aqi-ic {
    width: 1.15em;
    height: 1.15em;
    color: var(--aqi);
    filter: drop-shadow(0 0 0.3em var(--aqi));
  }
  .aqi--good {
    --aqi: #5ee8dd;
  }
  .aqi--fair {
    --aqi: #7ddcaa;
  }
  .aqi--moderate {
    --aqi: #f0e15a;
  }
  .aqi--poor {
    --aqi: #ff9a6e;
  }
  .aqi--veryPoor {
    --aqi: #ff6f91;
  }
  .aqi--extremelyPoor {
    --aqi: #c792ff;
  }

  /* Short screens: the cap card's height is the hero row's, so every line
     here competes with the clock. The moon glyph already shows the phase;
     its name stays for screen readers. */
  @media (max-height: 820px) {
    .weather-panel {
      gap: calc(var(--u) * 0.9);
    }
    .reads {
      gap: calc(var(--u) * 0.6);
    }
    .read {
      padding: calc(var(--u) * 0.6) calc(var(--u) * 0.9);
    }
    .moon-label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }

  /* Phone landscape: the condition moves beside the temperature instead of
     under it. The compass letters already carry the wind direction, and the
     dial's width is what pushes the gusts onto a line of their own. */
  @media (orientation: landscape) and (max-height: 520px) {
    .weather-panel {
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-rows: auto 1fr;
      column-gap: calc(var(--u) * 1.6);
    }
    .cap-now {
      grid-column: 1;
      grid-row: 1;
    }
    .cap-cond {
      grid-column: 2;
      grid-row: 1;
      align-self: center;
    }
    .reads {
      grid-column: 1 / -1;
    }
    .dial {
      display: none;
    }
  }

  /* Narrow columns: the low/high goes under the temperature, not beside it. */
  @media (orientation: portrait), (max-height: 520px) {
    .temp-row {
      flex-direction: column;
      align-items: flex-start;
      gap: calc(var(--u) * 0.4);
    }
    .range {
      flex-direction: row;
      gap: 0.7em;
    }
  }

  @media (orientation: portrait) {
    .weather-panel {
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
      grid-template-rows: auto auto;
      column-gap: calc(var(--u) * 3);
    }
    .cap-now {
      grid-column: 1;
      grid-row: 1;
    }
    .cap-cond {
      grid-column: 1;
      grid-row: 2;
    }
    .reads {
      grid-column: 2;
      grid-row: 1 / span 2;
      align-content: center;
    }
  }
</style>
