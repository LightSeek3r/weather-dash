<script lang="ts">
  // Renders into Layout's `tl` slot. Follows design/mockups/02-blue-hour.html's
  // .chart structure (hours row, icons row, temperature curve,
  // rain-probability bars), extended to scroll through the full hourly range
  // Open-Meteo returns (openMeteo.ts's `forecast_days`) instead of clipping
  // to 24h — each column is a fixed 1/24th of the *visible* width (the
  // `.viewport` container query, not `.chart`'s own now-wider width), so the
  // default (unscrolled) view still shows exactly the next 24h. No midnight
  // dashed rule: a vertical rule mid-strip used to read as "now", not as the
  // day change; a weekday label at each day boundary replaces it instead.
  import { presentWeather } from '../lib/weather/present'
  import { settingsStore } from '../lib/core/storage/settings'
  import { localeTag } from '../lib/ui/i18n'
  import { mapWmoCode } from '../lib/weather/mapWmo'
  import type { HourlyPoint } from '../lib/weather/types'

  let hourly = $derived($presentWeather?.hourly ?? [])

  let hourFormatter = $derived(
    new Intl.DateTimeFormat(localeTag($settingsStore.locale), {
      hour: '2-digit'
    })
  )
  let weekdayFormatter = $derived(
    new Intl.DateTimeFormat(localeTag($settingsStore.locale), {
      weekday: 'short'
    })
  )

  function xFor(i: number, n: number): number {
    return ((i + 0.5) / n) * 100
  }

  let temps = $derived(hourly.map((h) => h.temperature))
  let lo = $derived(temps.length ? Math.min(...temps) : 0)
  let hi = $derived(temps.length ? Math.max(...temps) : 1)

  function yFor(t: number): number {
    const range = hi - lo || 1
    return 88 - ((t - lo) / range) * 44
  }

  // Catmull-rom-ish smooth curve through the (x%, y%) points, same
  // construction as the mockup's chart-build script.
  function buildPaths(points: HourlyPoint[]): { line: string; area: string } {
    const n = points.length
    if (n === 0) return { line: '', area: '' }
    const pts: [number, number][] = points.map((p, i) => [
      xFor(i, n),
      yFor(p.temperature)
    ])
    let line = `M${pts[0][0]},${pts[0][1]}`
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[i + 2] ?? p2
      const c1: [number, number] = [
        p1[0] + (p2[0] - p0[0]) / 6,
        p1[1] + (p2[1] - p0[1]) / 6
      ]
      const c2: [number, number] = [
        p2[0] - (p3[0] - p1[0]) / 6,
        p2[1] - (p3[1] - p1[1]) / 6
      ]
      line += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`
    }
    const area = `${line} L${pts[n - 1][0]},100 L${pts[0][0]},100 Z`
    return { line, area }
  }

  let paths = $derived(buildPaths(hourly))
</script>

<div class="viewport">
  <div class="chart" style="--cols: {hourly.length}">
    <div class="row hours">
      {#each hourly as point, i (point.time)}
        {@const dayBoundary = i !== 0 && new Date(point.time).getHours() === 0}
        <span
          class={i === 0 ? 'n' : dayBoundary ? 'day' : i % 6 ? 'sparse' : ''}
        >
          {#if dayBoundary}
            {weekdayFormatter.format(new Date(point.time))}
          {:else if i % 3 === 0}
            {hourFormatter.format(new Date(point.time))}
          {/if}
        </span>
      {/each}
    </div>
    <div class="row icons">
      {#each hourly as point (point.time)}
        {@const visual = mapWmoCode(point.weatherCode, point.isDay)}
        <svg class="ic" aria-hidden="true"><use href="#{visual.icon}" /></svg>
      {/each}
    </div>
    <div class="curve">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="tl-area-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" class="fade-from" />
            <stop offset="1" class="fade-to" />
          </linearGradient>
        </defs>
        <path class="area" d={paths.area} />
        <path class="line" d={paths.line} />
      </svg>
      {#each hourly as point, i (point.time)}
        {#if i % 3 === 0}
          <span
            class={i === 0 ? 't now' : 't'}
            style="left:{xFor(i, hourly.length)}%;top:{yFor(
              point.temperature
            )}%"><span class="v">{Math.round(point.temperature)}°</span></span
          >
        {/if}
      {/each}
    </div>
    <div class="row rain">
      {#each hourly as point, i (point.time)}
        <div
          class={[
            point.precipitationProbability < 15 && 'dry',
            i % 3 && 'sparse'
          ]}
          style="height:{point.precipitationProbability}%"
        >
          {#if point.precipitationProbability >= 30}
            <span>{point.precipitationProbability}%</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  /* Establishes the container-query context at the *visible* width — the
     inner .chart is wider than this once hourly.length exceeds 24, so the
     breakpoints below (sized for the visible viewport, not the scrollable
     content) must key off .viewport, not .chart. */
  .viewport {
    container-type: inline-size;
    /* Padding and a matching negative margin leave the content box (and so
       every cqw below) unchanged but widen the clip box into the card's
       padding, which first-column labels use on narrow screens. */
    margin-inline: calc(var(--tl-pad-x, 0px) * -1);
    padding-inline: var(--tl-pad-x, 0px);
    overflow-x: auto;
    scrollbar-color: rgb(196 222 255 / 0.35) transparent;
    scrollbar-width: thin;
  }
  .viewport::-webkit-scrollbar {
    height: 6px;
  }
  .viewport::-webkit-scrollbar-thumb {
    background: rgb(196 222 255 / 0.35);
    border-radius: 99px;
  }
  .chart {
    position: relative;
    /* Each column is a fixed 1/24th of the viewport's width, so exactly the
       next 24h fill it with no scroll offset; the rest of --cols extends the
       chart's own width to the right, making .viewport scrollable. */
    width: calc(var(--cols) * (100cqw / 24));
  }
  /* 24 columns get narrow fast: per-hour rain percentages collide below
     ~40px a column, 3-hourly hour labels below ~25px. */
  @container (max-width: 1000px) {
    .rain .sparse span {
      visibility: hidden;
    }
  }
  @container (max-width: 600px) {
    .hours .sparse {
      visibility: hidden;
    }
  }
  .row {
    display: grid;
    grid-template-columns: repeat(var(--cols), calc(100cqw / 24));
  }
  .hours {
    font-size: var(--fs-s);
    color: var(--text-3);
  }
  .hours span {
    text-align: center;
    white-space: nowrap;
  }
  .hours .n {
    color: var(--peach);
    font-weight: 700;
  }
  .hours .day {
    color: var(--text-2);
    font-weight: 700;
  }
  .icons {
    height: calc(var(--u) * 3);
    align-items: center;
  }
  .icons .ic {
    width: calc(var(--u) * 2.8);
    height: calc(var(--u) * 2.8);
    justify-self: center;
    overflow: visible;
  }
  /* The labels keep their font floors while --u shrinks on small screens, so
     the band is at least as tall as a temperature label above its point plus
     the point's dot below it: without that floor the labels ran over the icons
     above and the rain percentages below. */
  .curve {
    position: relative;
    height: max(calc(var(--u) * 6), calc(var(--fs-m) * 4.2));
  }
  .curve svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .curve .line {
    fill: none;
    stroke: var(--ice);
    stroke-width: 3;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .curve .area {
    fill: url(#tl-area-fade);
  }
  .curve .fade-from {
    stop-color: var(--ice);
    stop-opacity: 0.34;
  }
  .curve .fade-to {
    stop-color: var(--ice);
    stop-opacity: 0;
  }
  .curve .t {
    position: absolute;
    translate: -50% -140%;
    font-family: var(--display);
    font-size: var(--fs-m);
    font-weight: 400;
    line-height: 1.2;
    color: var(--text);
  }
  .curve .t::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 140%;
    width: 9px;
    height: 9px;
    translate: -50% -50%;
    border-radius: 50%;
    background: var(--text);
    box-shadow: 0 0 0 4px rgb(238 244 251 / 0.14);
  }
  /* The first label is centred on the first column, which is narrower than
     the label on a phone: the text slides right just enough to stay inside
     the card while its dot stays on the curve. */
  .curve .t .v {
    display: inline-block;
  }
  .curve .t.now .v {
    translate: max(0px, calc(1.3em - 100cqw / 48 - var(--tl-pad-x, 0px))) 0;
  }
  .curve .t.now {
    color: var(--peach);
  }
  .curve .t.now::after {
    background: var(--peach);
    box-shadow: 0 0 0 5px rgb(255 184 150 / 0.22);
  }
  .rain {
    height: calc(var(--u) * 3);
    align-items: end;
    /* Room for the percentage label that sits on top of the tallest bars. */
    margin-top: max(calc(var(--u) * 0.4), calc(var(--fs-xs) * 1.5));
  }
  .rain div {
    position: relative;
    margin-inline: 22%;
    border-radius: 99px 99px 3px 3px;
    background: linear-gradient(180deg, var(--rain), rgb(124 196 255 / 0.45));
  }
  .rain div.dry {
    background: rgb(166 220 255 / 0.18);
  }
  .rain div span {
    position: absolute;
    bottom: 100%;
    left: 50%;
    translate: -50% -0.25em;
    font-size: var(--fs-xs);
    color: var(--ice);
  }
  /* Same slide for the first column's percentage. */
  .rain div:first-child span {
    translate: calc(-50% + max(0px, 1.3em - 100cqw / 48 - var(--tl-pad-x, 0px)))
      -0.25em;
  }

  /* Too short for labels above the bars without colliding with the curve;
     bar height alone still reads as the chance of rain. */
  @media (orientation: landscape) and (max-height: 520px) {
    .rain span {
      visibility: hidden;
    }
    .rain {
      margin-top: calc(var(--u) * 0.4);
    }
    /* Height is scarce here (the weather card shares the row): a label may
       graze the icons' empty margin, but must not push the card off screen. */
    .curve {
      height: max(calc(var(--u) * 6), calc(var(--fs-m) * 3.3));
    }
  }
</style>
