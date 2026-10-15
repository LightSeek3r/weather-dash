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
   * reduce. Nothing dims it near the glass cards or the text: the glass
   * and the text-shadow carry contrast on their own.
   */
  import { onMount } from 'svelte'
  import { presentWeather } from '../lib/weather/present'
  import { celestialStore } from '../lib/weather/celestial-store'
  import { celestialVisibility } from '../lib/weather/celestialPosition'
  import { mapWmoCode } from '../lib/weather/mapWmo'

  let pos = $derived($celestialStore)
  let snapshot = $derived($presentWeather)
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
  function onResize(): void {
    viewport = { w: window.innerWidth, h: window.innerHeight }
  }
  if (typeof window !== 'undefined') onResize()
  onMount(() => {
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })

  let size = $derived(
    Math.min(170, Math.max(52, 0.095 * Math.min(viewport.w, viewport.h)))
  )

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
    style:opacity={visibility.toFixed(3)}
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
    width: calc(var(--size) * 9);
    height: calc(var(--size) * 9);
  }
  .disc {
    width: var(--size);
    height: var(--size);
  }

  .sun .halo {
    background: radial-gradient(
      circle,
      rgb(255 250 232 / 1) 0,
      rgb(255 236 190 / 0.85) 9%,
      rgb(255 222 160 / 0.45) 20%,
      rgb(255 206 140 / 0.2) 38%,
      rgb(255 196 130 / 0.07) 56%,
      transparent 72%
    );
  }
  .sun .disc {
    background: radial-gradient(
      circle at 45% 42%,
      #ffffff 0,
      #fffbea 60%,
      #fff0c4 100%
    );
    box-shadow:
      0 0 calc(var(--size) * 0.4) calc(var(--size) * 0.18) rgb(255 250 230 / 1),
      0 0 calc(var(--size) * 1.4) calc(var(--size) * 0.5) rgb(255 228 170 / 0.8),
      0 0 calc(var(--size) * 3) calc(var(--size) * 0.8) rgb(255 208 140 / 0.4);
  }
  .sun.low .halo {
    background: radial-gradient(
      circle,
      rgb(255 226 190 / 1) 0,
      rgb(255 184 120 / 0.85) 10%,
      rgb(255 156 96 / 0.45) 22%,
      rgb(255 132 84 / 0.2) 40%,
      rgb(255 120 80 / 0.07) 58%,
      transparent 74%
    );
  }
  .sun.low .disc {
    background: radial-gradient(
      circle at 45% 42%,
      #fff8ea 0,
      #ffdcaa 55%,
      #ffb070 100%
    );
    box-shadow:
      0 0 calc(var(--size) * 0.4) calc(var(--size) * 0.18) rgb(255 214 170 / 1),
      0 0 calc(var(--size) * 1.4) calc(var(--size) * 0.5)
        rgb(255 160 104 / 0.75),
      0 0 calc(var(--size) * 3) calc(var(--size) * 0.8) rgb(255 130 84 / 0.35);
  }

  .moon .halo {
    width: calc(var(--size) * 6);
    height: calc(var(--size) * 6);
    background: radial-gradient(
      circle,
      rgb(226 236 255 / 0.7) 0,
      rgb(196 214 246 / 0.32) 18%,
      rgb(180 200 236 / 0.12) 38%,
      transparent 68%
    );
  }
  .moon .disc {
    overflow: visible;
    filter: drop-shadow(0 0 calc(var(--size) * 0.2) rgb(236 244 255 / 0.9));
  }
</style>
