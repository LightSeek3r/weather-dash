<script lang="ts">
  /**
   * The sun by day, the moon (in its current phase) by night, placed on the
   * rise → set arc from lib/weather/celestialPosition.ts. Rendered into
   * Layout's `sky` slot — above the sky gradient/photo, under the scrim and
   * the FX layer, which is what veils it in bad weather (plus
   * `celestialVisibility`, so a crisp disc never shows through a cloud deck).
   *
   * Static by design: it moves with the minute tick (a fraction of a percent
   * of the screen per minute), and nothing pulses, so there's no motion to
   * reduce. Behind text (the clock, the tomorrow strip) it dims to the same
   * calm-zone level the FX use, so a bright disc never sits under a digit.
   */
  import { onDestroy } from 'svelte'
  import { weatherStore } from '../lib/weather/store'
  import { celestialStore } from '../lib/weather/celestial-store'
  import { celestialVisibility } from '../lib/weather/celestialPosition'
  import { mapWmoCode } from '../lib/weather/mapWmo'
  import {
    CALM_FEATHER,
    calmAt,
    measureCalmZones,
    watchCalmZones
  } from '../lib/fx/calm-zones'

  let pos = $derived($celestialStore)
  let snapshot = $derived($weatherStore.snapshot)
  let visibility = $derived.by(() => {
    const c = snapshot?.current
    if (!c) return 0
    const v = mapWmoCode(c.weatherCode, c.isDay)
    return celestialVisibility(v.fx, v.conditionKey)
  })
  let isSun = $derived(pos?.body === 'sun')
  // Near the horizon the sun reddens (sunrise/sunset).
  let low = $derived(
    isSun && pos ? Math.min(pos.fraction, 1 - pos.fraction) < 0.08 : false
  )

  let viewport = $state({ w: 0, h: 0 })
  let layoutVersion = $state(0)
  function onResize(): void {
    viewport = { w: window.innerWidth, h: window.innerHeight }
    layoutVersion++
  }
  if (typeof window !== 'undefined') {
    onResize()
    window.addEventListener('resize', onResize)
  }
  const unwatch =
    typeof window !== 'undefined'
      ? watchCalmZones(() => layoutVersion++)
      : () => {}
  onDestroy(() => {
    unwatch()
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', onResize)
    }
  })

  let size = $derived(
    Math.min(140, Math.max(44, 0.08 * Math.min(viewport.w, viewport.h)))
  )

  let calm = $state(1)
  $effect(() => {
    void layoutVersion
    const p = pos
    const { w, h } = viewport
    if (!p || w <= 0 || h <= 0) {
      calm = 1
      return
    }
    const zones = measureCalmZones(document)
    const feather = Math.min(w, h) * CALM_FEATHER
    const cx = p.x * w
    const cy = p.y * h
    const r = size * 0.65
    let k = 1
    for (const [dx, dy] of [
      [0, 0],
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r]
    ]) {
      k = Math.min(k, calmAt(zones, cx + dx, cy + dy, feather))
    }
    calm = k
  })

  // Lit part of the moon as one path: the limb on the lit side, then the
  // terminator (a half-ellipse) back. Waxing is lit on the right in the
  // northern hemisphere; the southern hemisphere sees it mirrored.
  const R = 46
  let moonPath = $derived.by(() => {
    const f = snapshot?.moon.fraction ?? 0.5
    const waxing = f < 0.5
    const crescent = f < 0.25 || f > 0.75
    const rx = Math.abs(Math.cos(f * 2 * Math.PI)) * R
    const outer = waxing ? 1 : 0
    const inner = crescent ? (waxing ? 0 : 1) : waxing ? 1 : 0
    return `M 0 ${-R} A ${R} ${R} 0 0 ${outer} 0 ${R} A ${rx.toFixed(2)} ${R} 0 0 ${inner} 0 ${-R} Z`
  })
  let mirror = $derived((snapshot?.location.lat ?? 0) < 0)
</script>

{#if pos && visibility > 0}
  <div
    class="body"
    class:sun={isSun}
    class:moon={!isSun}
    class:low
    data-body={pos.body}
    style:left="{(pos.x * 100).toFixed(3)}%"
    style:top="{(pos.y * 100).toFixed(3)}%"
    style:--size="{size.toFixed(1)}px"
    style:opacity={(visibility * calm * (isSun ? 1 : 0.92)).toFixed(3)}
  >
    <div class="halo"></div>
    {#if isSun}
      <div class="disc"></div>
    {:else}
      <svg class="disc" viewBox="-50 -50 100 100">
        <defs>
          <radialGradient id="celestial-moon-lit" cx="0.42" cy="0.38" r="0.7">
            <stop offset="0" stop-color="#fbf8ee" />
            <stop offset="0.7" stop-color="#e6e6e2" />
            <stop offset="1" stop-color="#c9cfda" />
          </radialGradient>
        </defs>
        <circle r={R} fill="rgb(190 206 232 / 0.14)" />
        <path
          d={moonPath}
          fill="url(#celestial-moon-lit)"
          transform={mirror ? 'scale(-1 1)' : undefined}
        />
      </svg>
    {/if}
  </div>
{/if}

<style>
  .body {
    position: absolute;
    width: var(--size);
    height: var(--size);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .halo,
  .disc {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
  }
  .halo {
    width: calc(var(--size) * 6);
    height: calc(var(--size) * 6);
  }
  .disc {
    width: var(--size);
    height: var(--size);
  }

  .sun .halo {
    background: radial-gradient(
      circle,
      rgb(255 246 222 / 0.6) 0,
      rgb(255 226 170 / 0.28) 14%,
      rgb(255 206 140 / 0.1) 36%,
      transparent 70%
    );
  }
  .sun .disc {
    background: radial-gradient(
      circle at 45% 42%,
      #fffef8 0,
      #fff6d8 55%,
      #ffe2a0 100%
    );
    box-shadow:
      0 0 calc(var(--size) * 0.35) calc(var(--size) * 0.08)
        rgb(255 240 200 / 0.9),
      0 0 calc(var(--size) * 1.2) calc(var(--size) * 0.2)
        rgb(255 214 150 / 0.45);
  }
  .sun.low .halo {
    background: radial-gradient(
      circle,
      rgb(255 214 170 / 0.6) 0,
      rgb(255 170 110 / 0.3) 16%,
      rgb(255 140 90 / 0.12) 40%,
      transparent 72%
    );
  }
  .sun.low .disc {
    background: radial-gradient(
      circle at 45% 42%,
      #fff4e0 0,
      #ffd29a 55%,
      #ffa866 100%
    );
    box-shadow:
      0 0 calc(var(--size) * 0.35) calc(var(--size) * 0.08)
        rgb(255 200 150 / 0.85),
      0 0 calc(var(--size) * 1.2) calc(var(--size) * 0.2) rgb(255 150 100 / 0.4);
  }

  .moon .halo {
    width: calc(var(--size) * 4.5);
    height: calc(var(--size) * 4.5);
    background: radial-gradient(
      circle,
      rgb(214 226 246 / 0.32) 0,
      rgb(180 200 236 / 0.12) 26%,
      transparent 68%
    );
  }
  .moon .disc {
    overflow: visible;
    filter: drop-shadow(0 0 calc(var(--size) * 0.12) rgb(226 236 255 / 0.55));
  }
</style>
