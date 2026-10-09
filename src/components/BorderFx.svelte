<script lang="ts">
  /**
   * Weather-driven ambient effect across the sky, strongest along the
   * screen edges (plan decision: border FX by weather). Self-positioning
   * overlay — mount once anywhere in App.svelte, no Layout.svelte slot
   * needed.
   *
   * Two hosts. The back one sits at z-index 3: above Layout's photo/sky/
   * sun-moon/scrim layers (0–2, full order documented in Layout.svelte),
   * below `.page` (4) — weather on the window *behind* the text and glass
   * cards, flowing behind the glass unhindered. The front one
   * also sits at z-index 4 but after Layout in the DOM, so it paints over
   * the page text and still under the gear buttons (5) and every overlay:
   * a few near rays, wisps, flakes and streaks cross the clock for
   * immersion, while the glass cards are cut out of it entirely.
   *
   * Renders nothing until the first weather snapshot exists (no effect over
   * "no location set"), when the resolved tier is `off`, or when reduced
   * motion is in effect. Exactly one effect module is loaded and mounted at
   * a time; any change of effect/tier/density tears the previous one down
   * (canvas, WebGL context, frame loop, listeners) before the next mounts.
   */
  import { onDestroy } from 'svelte'
  import { settingsStore } from '../lib/core/storage/settings'
  import { weatherStore } from '../lib/weather/store'
  import { mapWmoCode } from '../lib/weather/mapWmo'
  import { resolveFxTier, resolveReducedMotion } from '../lib/fx/tiers'
  import { scheduler } from '../lib/core/scheduler'
  import { isNightMode } from '../lib/core/night-mode'
  import {
    densityFor,
    loadEffect,
    pickEffect,
    type EffectId
  } from '../lib/fx/border'
  import type { BorderEffect } from '../lib/fx/border/types'
  import { debugParams } from '../lib/core/debug-params'
  import { celestialStore } from '../lib/weather/celestial-store'
  import type { CelestialPosition } from '../lib/weather/celestialPosition'

  let host = $state<HTMLDivElement | null>(null)
  let frontHost = $state<HTMLDivElement | null>(null)
  let osReducedMotion = $state(false)

  // Night mode dims the whole view for battery/burn-in reasons (see
  // NightDim.svelte) — an ambient border effect still animating underneath
  // that dim would defeat half the point, so treat night mode the same as
  // an explicit `fxQuality: 'off'` rather than letting the two features
  // disagree about whether the screen should be quiet right now.
  // `?freeze=1`/`?now=` (see lib/core/debug-params.ts): seed the frozen
  // instant so night-mode gating (and thus which tier/effect mounts) is
  // deterministic under the debug flag rather than depending on the real
  // wall-clock time the test happens to run at.
  let now = $state(debugParams.now ?? new Date())
  const unsubscribeClock = scheduler.on('minute', (tickNow) => {
    now = tickNow
  })
  onDestroy(unsubscribeClock)
  let night = $derived(
    isNightMode(
      now,
      $settingsStore.nightMode.start,
      $settingsStore.nightMode.end
    )
  )

  let tier = $derived(
    night
      ? 'off'
      : resolveFxTier(
          $settingsStore.fxQuality,
          resolveReducedMotion($settingsStore.reducedMotion, osReducedMotion)
        )
  )
  let current = $derived($weatherStore.snapshot?.current ?? null)
  let visual = $derived(
    current ? mapWmoCode(current.weatherCode, current.isDay) : null
  )
  // Primitives only, so an hourly refresh with unchanged conditions (a new
  // snapshot object, same code) doesn't re-run the mount effect below.
  let effectId = $derived<EffectId | null>(
    current && visual && tier !== 'off'
      ? pickEffect(visual.fx, current.isDay, tier)
      : null
  )
  let density = $derived(visual ? densityFor(visual.fx, visual.intensity) : 0)
  // Primitives only (see the effectId comment above) — read separately so
  // an effect module can tell partly-cloudy from overcast, drizzle from
  // rain, without pickEffect() needing a distinct EffectId per pair.
  let conditionKey = $derived(visual?.conditionKey ?? null)
  let intensity = $derived(visual?.intensity)
  let hail = $derived(visual?.hail === true)
  let isDay = $derived(current?.isDay ?? true)

  // Plain variable, deliberately not $state: effects read it per frame via
  // the getter below, and the sun/moon moving every minute must not re-run
  // the mount effect (a remount per minute).
  let latestCelestial: CelestialPosition | null = null
  onDestroy(celestialStore.subscribe((p) => (latestCelestial = p)))
  const celestial = (): CelestialPosition | null => latestCelestial

  // Reads state, never writes it: mounting happens after an async import,
  // outside this effect's tracking scope, so nothing an effect module does
  // can feed back into this effect (see Background.svelte's untrack note).
  $effect(() => {
    const el = host
    const id = effectId
    const activeTier = tier
    const d = density
    const ck = conditionKey
    const it = intensity
    const hl = hail
    const day = isDay
    const front = frontHost
    if (!el || !front || !id || activeTier === 'off') return

    let cancelled = false
    let fx: BorderEffect | null = null
    loadEffect(id)
      .then((create) => {
        if (cancelled) return
        fx = create()
        fx.mount(el, {
          tier: activeTier,
          density: d,
          conditionKey: ck ?? undefined,
          intensity: it,
          hail: hl,
          isDay: day,
          frozen: debugParams.freeze,
          celestial,
          front
        })
      })
      .catch((err) => console.warn(`[fx] could not load "${id}"`, err))

    return () => {
      cancelled = true
      fx?.unmount()
      fx = null
    }
  })

  $effect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    osReducedMotion = media.matches
    const onChange = (e: MediaQueryListEvent): void => {
      osReducedMotion = e.matches
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  })
</script>

{#if effectId}
  <div
    class="border-fx"
    bind:this={host}
    aria-hidden="true"
    data-fx={effectId}
    data-tier={tier}
  ></div>
  <div
    class="border-fx border-fx--front"
    bind:this={frontHost}
    aria-hidden="true"
    data-fx-layer="front"
  ></div>
{/if}

<style>
  .border-fx {
    position: fixed;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    overflow: hidden;
    contain: strict;
  }
  .border-fx--front {
    z-index: 4;
  }
</style>
