<script lang="ts">
  import { relativeTime } from '../lib/ui/status'
  import { settingsStore } from '../lib/core/storage/settings'
  import { t } from '../lib/ui/strings'
  import { debugParams } from '../lib/core/debug-params'

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
    !online
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
    class:status-pill__dot--stale={online && stale}
    aria-label={label}
    aria-haspopup="true"
    aria-expanded={detailOpen}
    onclick={toggleDetail}
  ></button>
  {#if detailOpen}
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

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
