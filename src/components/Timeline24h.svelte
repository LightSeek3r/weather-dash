<script lang="ts">
  // Renders into Layout's `tl` slot. Rolling next-24h strip, following
  // design/mockups/02-blue-hour.html's .chart structure (hours row, icons
  // row, temperature curve, rain-probability bars, midnight marker).
  import { weatherStore } from '../lib/weather/store'
  import { settingsStore } from '../lib/core/storage/settings'
  import { localeTag } from '../lib/ui/i18n'
  import { mapWmoCode } from '../lib/weather/mapWmo'
  import type { HourlyPoint } from '../lib/weather/types'

  let hourly = $derived($weatherStore.snapshot?.hourly ?? [])

  let hourFormatter = $derived(
    new Intl.DateTimeFormat(localeTag($settingsStore.locale), {
      hour: '2-digit'
    })
  )
  let dayFormatter = $derived(
    new Intl.DateTimeFormat(localeTag($settingsStore.locale), {
      weekday: 'short',
      day: 'numeric'
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

  // First index whose local day differs from the first point's — the
  // "midnight crossing" marker. `>1` check avoids a spurious marker if the
  // rolling window happens to start exactly at midnight (index 0 IS the new
  // day, nothing to mark).
  let midnightIndex = $derived.by(() => {
    if (hourly.length < 2) return -1
    const firstDay = new Date(hourly[0].time).getDate()
    const idx = hourly.findIndex((h) => new Date(h.time).getDate() !== firstDay)
    return idx > 0 ? idx : -1
  })
  let midnightLabel = $derived(
    midnightIndex >= 0
      ? dayFormatter.format(new Date(hourly[midnightIndex].time))
      : ''
  )
</script>

<div class="chart">
  <div class="row hours">
    {#each hourly as point, i (point.time)}
      <span class={i === 0 ? 'n' : ''}>
        {#if i === 0}
          Now
        {:else if i % 3 === 0 && i !== midnightIndex}
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
      <path class="area" d={paths.area} />
      <path class="line" d={paths.line} />
    </svg>
    {#each hourly as point, i (point.time)}
      {#if i % 3 === 0}
        <span
          class={i === 0 ? 't now' : 't'}
          style="left:{xFor(i, hourly.length)}%;top:{yFor(point.temperature)}%"
          >{Math.round(point.temperature)}°</span
        >
      {/if}
    {/each}
  </div>
  <div class="row rain">
    {#each hourly as point (point.time)}
      <div
        class={point.precipitationProbability < 15 ? 'dry' : ''}
        style="height:{Math.max(point.precipitationProbability, 4)}%"
      >
        {#if point.precipitationProbability >= 30}
          <span>{point.precipitationProbability}%</span>
        {/if}
      </div>
    {/each}
  </div>
  {#if midnightIndex >= 0}
    <div class="midnight" style="left:{(midnightIndex / hourly.length) * 100}%">
      <span>{midnightLabel}</span>
    </div>
  {/if}
</div>

<style>
  .chart {
    position: relative;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(24, minmax(0, 1fr));
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
  .curve {
    position: relative;
    height: calc(var(--u) * 6);
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
    fill: var(--ice);
    opacity: 0.14;
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
    margin-top: calc(var(--u) * 0.4);
  }
  .rain div {
    position: relative;
    margin-inline: 22%;
    border-radius: 99px 99px 3px 3px;
    background: linear-gradient(180deg, var(--rain), rgb(124 196 255 / 0.45));
    min-height: 3px;
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
  .midnight {
    position: absolute;
    top: 0;
    bottom: 0;
    border-left: 1.5px dashed rgb(222 238 255 / 0.35);
  }
  .midnight span {
    position: absolute;
    top: calc(var(--u) * -0.2);
    left: 0;
    translate: -50% 0;
    padding: 0.1em 0.7em;
    border-radius: 99px;
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--sky-0);
    background: var(--text-2);
    white-space: nowrap;
  }
</style>
