<script lang="ts">
  /**
   * Periodic full-viewport scene (plan decision: every
   * `fullscreenScene.intervalSeconds` for `durationSeconds`, tap to dismiss,
   * weather-matched, skipped in night mode — scheduling lives in
   * lib/core/scene-schedule.ts). Its job is burn-in relief: for a few
   * seconds every pixel the static dashboard normally pins (clock digits,
   * glass panel edges) shows slow-moving soft colour instead.
   *
   * Only transform/opacity animate (compositor-only, no per-frame paint),
   * and nothing is mounted between scenes, so the idle cost is zero.
   *
   * Reduced motion: shows a static version rather than skipping — the
   * pixels still get their rest, which is the point; only the drift goes.
   */
  import { untrack } from 'svelte'
  import { fade } from 'svelte/transition'
  import { settingsStore } from '../lib/core/storage/settings'
  import { weatherStore } from '../lib/weather/store'
  import { mapWmoCode } from '../lib/weather/mapWmo'
  import {
    createSceneSchedule,
    type SceneSchedule
  } from '../lib/core/scene-schedule'
  import { reducedMotion } from '../lib/ui/reduced-motion'
  import { t } from '../lib/ui/strings'

  const FADE_MS = 900

  let s = $derived(t($settingsStore.locale))
  let intervalSeconds = $derived($settingsStore.fullscreenScene.intervalSeconds)
  let durationSeconds = $derived($settingsStore.fullscreenScene.durationSeconds)
  let nightStart = $derived($settingsStore.nightMode.start)
  let nightEnd = $derived($settingsStore.nightMode.end)

  let current = $derived($weatherStore.snapshot?.current ?? null)
  let visual = $derived(
    current ? mapWmoCode(current.weatherCode, current.isDay) : null
  )
  let palette = $derived(
    !visual
      ? 'default'
      : visual.fx === 'clear'
        ? current?.isDay
          ? 'clear-day'
          : 'clear-night'
        : visual.fx
  )

  interface Drift {
    fromX: number
    fromY: number
    toX: number
    toY: number
  }

  let active = $state(false)
  let drift = $state<Drift>({ fromX: 0, fromY: 0, toX: 0, toY: 0 })
  let schedule: SceneSchedule | null = null

  /** Fresh icon path per scene so its bright pixels land somewhere new each time. */
  function randomDrift(): Drift {
    const angle = Math.random() * Math.PI * 2
    const dx = Math.round(Math.cos(angle) * 28)
    const dy = Math.round(Math.sin(angle) * 18)
    return { fromX: -dx, fromY: -dy, toX: dx, toY: dy }
  }

  $effect(() => {
    const created = createSceneSchedule({
      intervalSeconds,
      durationSeconds,
      nightMode: { start: nightStart, end: nightEnd }
    })
    schedule = created
    // subscribe() calls back synchronously, i.e. while this effect is still
    // tracking — untrack so the state writes below can never feed back
    // into it (the phase-4 effect_update_depth_exceeded failure mode).
    const unsubscribe = created.active.subscribe((next) => {
      untrack(() => {
        if (next) drift = randomDrift()
        active = next
      })
    })
    return () => {
      unsubscribe()
      created.destroy()
      if (schedule === created) schedule = null
    }
  })

  function dismiss(): void {
    schedule?.dismiss()
  }

  function onKeydown(e: KeyboardEvent): void {
    if (active && e.key === 'Escape') dismiss()
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if active}
  <button
    type="button"
    class="scene"
    class:static={$reducedMotion}
    data-palette={palette}
    style="--scene-dur: {durationSeconds}s; --from-x: {drift.fromX}vw; --from-y: {drift.fromY}vh; --to-x: {drift.toX}vw; --to-y: {drift.toY}vh;"
    aria-label={s.scene.tapToReturn}
    onclick={dismiss}
    transition:fade={{ duration: $reducedMotion ? 0 : FADE_MS }}
  >
    <span class="blob b1" aria-hidden="true"></span>
    <span class="blob b2" aria-hidden="true"></span>
    <span class="blob b3" aria-hidden="true"></span>
    <span class="sweep" aria-hidden="true"></span>
    {#if visual}
      <svg class="icon" aria-hidden="true"><use href="#{visual.icon}" /></svg>
    {/if}
    <span class="hint" aria-hidden="true">{s.scene.tapToReturn}</span>
  </button>
{/if}

<style>
  .scene {
    position: fixed;
    inset: 0;
    /* Above the dashboard and gear (<=5), under NightDim (9), the start
       overlay (10), the settings sheet (20) and toasts. */
    z-index: 8;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    overflow: hidden;
    cursor: pointer;
    font: inherit;
    color: var(--text-3);
    background: linear-gradient(
      178deg,
      var(--sky-0) 0%,
      var(--sky-1) 52%,
      var(--sky-2) 100%
    );

    /* Blue Hour palette, re-weighted per weather below. */
    --c1: rgb(255 150 118 / 0.34);
    --c2: rgb(92 170 210 / 0.3);
    --c3: rgb(124 196 255 / 0.22);
  }
  .scene[data-palette='clear-day'] {
    --c1: rgb(255 184 150 / 0.42);
    --c2: rgb(255 214 170 / 0.26);
    --c3: rgb(166 220 255 / 0.24);
  }
  .scene[data-palette='clear-night'] {
    --c1: rgb(70 96 190 / 0.36);
    --c2: rgb(166 220 255 / 0.2);
    --c3: rgb(140 110 200 / 0.24);
  }
  .scene[data-palette='cloudy'],
  .scene[data-palette='fog'] {
    --c1: rgb(150 170 195 / 0.26);
    --c2: rgb(189 205 221 / 0.18);
    --c3: rgb(92 130 170 / 0.24);
  }
  .scene[data-palette='rain'],
  .scene[data-palette='drizzle'] {
    --c1: rgb(124 196 255 / 0.32);
    --c2: rgb(60 110 170 / 0.34);
    --c3: rgb(166 220 255 / 0.18);
  }
  .scene[data-palette='snow'] {
    --c1: rgb(230 242 255 / 0.26);
    --c2: rgb(166 220 255 / 0.26);
    --c3: rgb(200 215 240 / 0.2);
  }
  .scene[data-palette='storm'] {
    --c1: rgb(120 100 200 / 0.34);
    --c2: rgb(124 196 255 / 0.24);
    --c3: rgb(60 70 130 / 0.34);
  }

  .blob {
    position: absolute;
    width: 70vmax;
    height: 70vmax;
    border-radius: 50%;
    will-change: transform;
    animation-duration: var(--scene-dur, 20s);
    animation-timing-function: ease-in-out;
    animation-fill-mode: both;
  }
  .b1 {
    left: -20vmax;
    top: -25vmax;
    background: radial-gradient(circle, var(--c1), transparent 62%);
    animation-name: wander-1;
  }
  .b2 {
    right: -25vmax;
    bottom: -30vmax;
    background: radial-gradient(circle, var(--c2), transparent 62%);
    animation-name: wander-2;
  }
  .b3 {
    left: 15vw;
    top: 20vh;
    background: radial-gradient(circle, var(--c3), transparent 60%);
    animation-name: wander-3;
  }

  /* One slow diagonal band of light crossing the whole screen per scene. */
  .sweep {
    position: absolute;
    inset: -50% -100%;
    background: linear-gradient(
      105deg,
      transparent 40%,
      rgb(238 244 251 / 0.07) 50%,
      transparent 60%
    );
    will-change: transform;
    animation: sweep var(--scene-dur, 20s) linear both;
  }

  .icon {
    position: absolute;
    left: 50%;
    top: 50%;
    width: min(40vmin, 36vh);
    height: min(40vmin, 36vh);
    margin: calc(min(40vmin, 36vh) / -2);
    opacity: 0.85;
    filter: drop-shadow(0 0 4vmin rgb(166 220 255 / 0.18));
    will-change: transform;
    animation: icon-drift var(--scene-dur, 20s) ease-in-out both;
  }

  .hint {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(var(--pad) * 0.8);
    text-align: center;
    font-family: var(--text-font);
    font-size: var(--fs-s);
    letter-spacing: 0.04em;
    opacity: 0.8;
  }

  .scene:focus-visible {
    outline: 2px solid var(--ice);
    outline-offset: -2px;
  }

  .static .blob,
  .static .sweep,
  .static .icon {
    animation: none;
  }
  .static .icon {
    transform: translate(var(--from-x), var(--from-y));
  }

  @keyframes wander-1 {
    from {
      transform: translate(0, 0) scale(1);
    }
    to {
      transform: translate(45vw, 35vh) scale(1.25);
    }
  }
  @keyframes wander-2 {
    from {
      transform: translate(0, 0) scale(1.1);
    }
    to {
      transform: translate(-50vw, -30vh) scale(0.9);
    }
  }
  @keyframes wander-3 {
    0% {
      transform: translate(0, 0) scale(0.8);
    }
    50% {
      transform: translate(-25vw, 20vh) scale(1.2);
    }
    100% {
      transform: translate(20vw, -15vh) scale(1);
    }
  }
  @keyframes sweep {
    from {
      transform: translateX(-30%);
    }
    to {
      transform: translateX(30%);
    }
  }
  @keyframes icon-drift {
    from {
      transform: translate(var(--from-x), var(--from-y)) scale(0.92);
    }
    to {
      transform: translate(var(--to-x), var(--to-y)) scale(1.05);
    }
  }
</style>
