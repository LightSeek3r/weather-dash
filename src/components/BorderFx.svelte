<script lang="ts">
  /**
   * Weather-driven ambient effect around the screen edges (plan decision:
   * border FX by weather). Self-positioning overlay — mount once anywhere
   * in App.svelte, no Layout.svelte slot needed.
   *
   * Sits at z-index 3: above Layout's sky/photo/scrim layers (0–2), below
   * `.page` (4), so the effect reads as weather on the window *behind* the
   * glass cards and can never cover text or controls.
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

  let host = $state<HTMLDivElement | null>(null)
  let osReducedMotion = $state(false)

  // Night mode dims the whole view for battery/burn-in reasons (see
  // NightDim.svelte) — an ambient border effect still animating underneath
  // that dim would defeat half the point, so treat night mode the same as
  // an explicit `fxQuality: 'off'` rather than letting the two features
  // disagree about whether the screen should be quiet right now.
  let now = $state(new Date())
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

  // Reads state, never writes it: mounting happens after an async import,
  // outside this effect's tracking scope, so nothing an effect module does
  // can feed back into this effect (see Background.svelte's untrack note).
  $effect(() => {
    const el = host
    const id = effectId
    const activeTier = tier
    const d = density
    if (!el || !id || activeTier === 'off') return

    let cancelled = false
    let fx: BorderEffect | null = null
    loadEffect(id)
      .then((create) => {
        if (cancelled) return
        fx = create()
        fx.mount(el, { tier: activeTier, density: d })
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
</style>
