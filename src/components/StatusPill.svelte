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

  let label = $derived(
    !online
      ? s.status.offline
      : lastUpdated
        ? `${s.status.updatedPrefix} ${relativeTime(lastUpdated, now, s.status.relative)}`
        : s.status.noDataYet
  )
</script>

<!--
  TODO: confirm token names once design-tokens.css lands — falls back to
  sensible dusk-palette values so this looks reasonable standalone.
-->
<div
  class="status-pill"
  class:status-pill--offline={!online}
  role="status"
  aria-live="polite"
>
  <span class="status-pill__dot" aria-hidden="true"></span>
  <span class="status-pill__label">{label}</span>
</div>

<style>
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.35em 0.9em;
    border-radius: var(--radius-full, 999px);
    background: var(--color-glass, rgba(196, 222, 255, 0.075));
    border: 1px solid var(--color-glass-edge, rgba(222, 238, 255, 0.16));
    color: var(--color-text-2, rgba(238, 244, 251, 0.75));
    font-family: var(--font-body, 'Atkinson Hyperlegible', sans-serif);
    font-size: var(--font-size-sm, 0.85rem);
  }

  .status-pill__dot {
    width: 0.6em;
    height: 0.6em;
    border-radius: 50%;
    background: var(--color-accent, #a6dcff);
    box-shadow: 0 0 10px var(--color-accent, #a6dcff);
  }

  .status-pill--offline .status-pill__dot {
    background: var(--color-error, #ff8a8a);
    box-shadow: 0 0 10px var(--color-error, #ff8a8a);
  }
</style>
