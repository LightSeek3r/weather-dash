<script lang="ts">
  import { relativeTime } from '../lib/ui/status'
  import { settingsStore } from '../lib/core/storage/settings'
  import { t } from '../lib/ui/strings'
  import { debugParams } from '../lib/core/debug-params'
  import { updateReady, applyAppUpdate } from '../lib/core/app-update'

  interface Props {
    lastUpdated: Date | null
    online?: boolean
  }

  let { lastUpdated, online = true }: Props = $props()

  let s = $derived(t($settingsStore.locale))
  // `?freeze=1`/`?now=` (see lib/core/debug-params.ts): seed the frozen
  // instant directly, and skip the interval below entirely — a real 30s
  // tick would otherwise drift this pill's "now" away from the frozen one
  // used everywhere else once a test run outlives 30s.
  let now = $state(debugParams.now ?? new Date())

  // Re-render "Xm ago" as time passes even though `lastUpdated` itself
  // doesn't change — 30s is plenty granular for a label that only ever
  // shows minute/hour resolution.
  $effect(() => {
    if (debugParams.freeze) return
    const refreshTimer = setInterval(() => {
      now = new Date()
    }, 30000)
    return () => clearInterval(refreshTimer)
  })

  // Hourly refresh, so two missed ones (or a days-old cached snapshot at
  // boot) means the numbers on screen can't be trusted — the dot must say
  // so without anyone tapping it.
  const STALE_MS = 2 * 60 * 60 * 1000
  let stale = $derived(
    !lastUpdated || now.getTime() - lastUpdated.getTime() > STALE_MS
  )

  let label = $derived(
    $updateReady
      ? s.status.update
      : !online
      ? s.status.offline
      : lastUpdated
        ? `${s.status.updatedPrefix} ${relativeTime(lastUpdated, now, s.status.relative)}`
        : s.status.noDataYet
  )

  // The always-visible text pill read as noise with no payoff on a 24/7
  // wall display — a small dot is the ambient signal, the text only
  // appears when someone actually cares enough to tap it. Screen readers
  // still get the same "went offline"-style updates passively via the
  // hidden live region below, independent of whether the popover is open.
  let detailOpen = $state(false)
  let rootEl: HTMLDivElement | undefined

  // A newer version turns the dot into an invitation: it opens by itself,
  // then folds back into a pulsing dot (so an unattended wall display isn't
  // left with a card over the forecast) — tapping the dot reopens it, and the
  // nightly reload applies the update if nobody does.
  const INVITE_MS = 30_000
  $effect(() => {
    if (!$updateReady) return
    detailOpen = true
    if (debugParams.freeze) return
    const fold = setTimeout(() => (detailOpen = false), INVITE_MS)
    return () => clearTimeout(fold)
  })

  function toggleDetail(): void {
    detailOpen = !detailOpen
  }

  function handlePointerDown(e: PointerEvent): void {
    if (rootEl && !rootEl.contains(e.target as Node)) detailOpen = false
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') detailOpen = false
  }

  $effect(() => {
    if (!detailOpen) return
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeydown)
    }
  })
</script>

<div class="status-pill" bind:this={rootEl}>
  <span class="sr-only" role="status" aria-live="polite">{label}</span>
  <button
    type="button"
    class="status-pill__dot"
    data-fx-calm
    class:status-pill__dot--offline={!online}
    class:status-pill__dot--stale={online && stale && !$updateReady}
    class:status-pill__dot--update={$updateReady}
    aria-label={label}
    aria-haspopup="true"
    aria-expanded={detailOpen}
    onclick={toggleDetail}
  ></button>
  {#if detailOpen && $updateReady}
    <div class="status-pill__detail status-pill__invite" data-fx-calm>
      <span>{s.status.update}</span>
      <button
        type="button"
        class="status-pill__reload"
        onclick={applyAppUpdate}
      >
        {s.status.reload}
      </button>
    </div>
  {:else if detailOpen}
    <p class="status-pill__detail" data-fx-calm>{label}</p>
  {/if}
</div>

<style>
  /* Pinned to the screen's bottom-right corner, mirroring Tomorrow's
     bottom-left placement in the same footer row — not just right-aligned
     within `.tm`'s flow, the actual corner. Same `position: fixed` pattern
     App.svelte's `.gear`/`.gear--fullscreen` buttons already use, sized to
     the same 2.75rem footprint so all three sit on one consistent grid;
     App.svelte shifts `.gear`/`.gear--fullscreen` left to make room here
     (see the comment there). */
  .status-pill {
    position: fixed;
    right: var(--space-md, 1.5rem);
    bottom: var(--space-md, 1.5rem);
    z-index: 5;
    width: 2.75rem;
    height: 2.75rem;
    display: grid;
    place-items: center;
  }

  .status-pill__dot {
    display: block;
    width: 0.85rem;
    height: 0.85rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--color-accent, #a6dcff);
    box-shadow: 0 0 8px var(--color-accent, #a6dcff);
    cursor: pointer;
  }

  .status-pill__dot--stale {
    background: var(--color-text-2, rgba(238, 244, 251, 0.75));
    box-shadow: none;
  }

  /* Ringed and pulsing: the one state of this dot that asks for an action. */
  .status-pill__dot--update {
    animation: status-pill-pulse 2s ease-out infinite;
  }
  @keyframes status-pill-pulse {
    from {
      box-shadow:
        0 0 8px var(--color-accent, #a6dcff),
        0 0 0 0 var(--color-accent, #a6dcff);
    }
    to {
      box-shadow:
        0 0 8px var(--color-accent, #a6dcff),
        0 0 0 0.9rem transparent;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .status-pill__dot--update {
      animation: none;
    }
  }

  .status-pill__dot--offline {
    background: var(--color-error, #ff9a86);
    box-shadow: 0 0 8px var(--color-error, #ff9a86);
  }

  .status-pill__detail {
    position: absolute;
    right: 0;
    bottom: calc(100% + var(--space-sm, 0.6rem));
    margin: 0;
    padding: 0.5em 0.9em;
    white-space: nowrap;
    border-radius: var(--radius-md, 1rem);
    /* Solid enough to read over bright FX (bright sun/lightning) behind it —
       the shared low-opacity `--color-glass` tint the big panels use relies
       on their own 22px blur to stay legible; this floats free-standing over
       whatever's behind it, so it needs a background closer to
       SettingsSheet's own solid-ish `rgb(9 20 34 / 0.92)` sheet header. */
    background: rgb(9 20 34 / 0.92);
    border: 1px solid var(--color-glass-edge, rgba(222, 238, 255, 0.18));
    color: var(--color-text-2, rgba(238, 244, 251, 0.75));
    font-family: var(--font-body, 'Atkinson Hyperlegible', sans-serif);
    font-size: var(--font-size-sm, 0.85rem);
    backdrop-filter: blur(16px);
  }

  .status-pill__invite {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4em 0.9em;
    width: max-content;
    max-width: calc(100vw - 2 * var(--space-md, 1.5rem));
    white-space: normal;
    color: var(--color-text, #eef4fb);
  }
  .status-pill__reload {
    padding: 0.35em 1em;
    border: none;
    border-radius: var(--radius-full, 999px);
    background: var(--color-accent, #a6dcff);
    color: #0a1726;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .status-pill__reload:hover {
    filter: brightness(1.1);
  }
  .status-pill__reload:focus-visible {
    outline: 2px solid var(--color-text, #eef4fb);
    outline-offset: 2px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
