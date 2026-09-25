<script lang="ts">
  /**
   * Scheduled night dim (plan decision: dim overlay only — same layout,
   * nothing hidden or swapped for a clock-only view). Re-evaluated on the
   * shared minute tick and immediately on any nightMode settings change.
   */
  import { onDestroy } from 'svelte'
  import { scheduler } from '../lib/core/scheduler'
  import { isNightMode } from '../lib/core/night-mode'
  import { settingsStore } from '../lib/core/storage/settings'
  import { reducedMotion } from '../lib/ui/reduced-motion'
  import { debugParams } from '../lib/core/debug-params'

  // `?freeze=1`/`?now=` (see lib/core/debug-params.ts): seed the frozen
  // instant so night-mode detection is deterministic under the debug flag
  // instead of depending on the real wall-clock time the test happens to
  // run at.
  let now = $state(debugParams.now ?? new Date())
  const unsubscribe = scheduler.on('minute', (tickNow) => {
    now = tickNow
  })
  onDestroy(unsubscribe)

  let night = $derived(
    isNightMode(
      now,
      $settingsStore.nightMode.start,
      $settingsStore.nightMode.end
    )
  )
</script>

<div
  class="night-dim"
  class:on={night}
  class:no-motion={$reducedMotion}
  data-night={night ? '' : undefined}
  aria-hidden="true"
></div>

<style>
  /* Strength 0.4 (content keeps 60% of its sRGB value, ~33% of its
     emitted light — a ~2/3 cut for battery/OLED wear and a calmer room).
     Contrast over the sky under it: --text ~6.4:1 and --text-2 ~4.6:1
     (both still WCAG AA), --text-3 labels ~3.3:1 (AA large-text). Past
     ~0.4 --text-2 drops under 4.5:1; the aim is dimmer, not unreadable.
     Near-black rather than #000, matching the tokens' no-pure-black rule. */
  .night-dim {
    position: fixed;
    inset: 0;
    z-index: 9;
    pointer-events: none;
    background: rgb(2 6 12);
    opacity: 0;
    visibility: hidden;
    /* visibility delayed until the fade-out ends so the layer drops out of
       compositing entirely during the day instead of idling at opacity 0. */
    transition:
      opacity 4s ease-in-out,
      visibility 0s linear 4s;
  }
  .night-dim.on {
    opacity: 0.4;
    visibility: visible;
    transition:
      opacity 4s ease-in-out,
      visibility 0s linear 0s;
  }
  .night-dim.no-motion {
    transition: none;
  }
</style>
