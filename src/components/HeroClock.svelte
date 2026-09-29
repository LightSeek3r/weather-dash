<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { scheduler } from '../lib/core/scheduler'
  import { settingsStore } from '../lib/core/storage/settings'
  import { localeTag } from '../lib/ui/i18n'
  import { debugParams } from '../lib/core/debug-params'

  // Reads the user's clock-format choice from settings by default — props
  // exist only so a caller (tests, future preview UI) can override without
  // touching the store.
  interface Props {
    hour12?: boolean
    showSeconds?: boolean
  }

  let { hour12, showSeconds }: Props = $props()

  // `?freeze=1`/`?now=` (see lib/core/debug-params.ts): seed the frozen
  // instant directly since scheduler.start() is skipped while frozen, so
  // the 'second' subscription below never fires again to correct a real
  // `new Date()` initial value.
  let now = $state(debugParams.now ?? new Date())
  let unsubscribe: (() => void) | undefined

  onMount(() => {
    unsubscribe = scheduler.on('second', (tickNow) => {
      now = tickNow
    })
  })
  onDestroy(() => unsubscribe?.())

  let effectiveHour12 = $derived(
    hour12 ?? $settingsStore.clock.format === '12h'
  )
  let effectiveShowSeconds = $derived(
    showSeconds ?? $settingsStore.clock.showSeconds
  )

  let formatter = $derived(
    new Intl.DateTimeFormat(localeTag($settingsStore.locale), {
      hour: '2-digit',
      minute: '2-digit',
      second: effectiveShowSeconds ? '2-digit' : undefined,
      hour12: effectiveHour12
    })
  )

  // formatToParts (not manual string concatenation) so the colon separator
  // can be styled on its own and 12h locales' AM/PM literal renders correctly.
  let parts = $derived(formatter.formatToParts(now))
</script>

<time class="clock" datetime={now.toISOString()}>
  <!-- <bdi dir="ltr">: the digit groups and the `.sep` colon between them are
       separate inline elements, and RTL locales (ar/ur) would otherwise
       reorder them as sibling boxes — "17:30" rendering as "30:17" — the way
       a clock face never actually flips digit order just because the
       surrounding UI is RTL. Isolating only this inner run (rather than
       putting dir="ltr" on .clock itself) keeps .clock's own text-align, and
       so its position within .hero, following the page's actual direction. -->
  <bdi dir="ltr">
    {#each parts as part, i (i + part.type)}
      {#if part.type === 'literal'}
        <span class="sep">{part.value}</span>
      {:else if part.type === 'dayPeriod'}
        <span class="period">{part.value}</span>
      {:else}
        {part.value}
      {/if}
    {/each}
  </bdi>
</time>

<style>
  .clock {
    display: block;
    font-family: var(--display);
    font-size: var(--fs-clock);
    font-weight: 250;
    line-height: 0.86;
    letter-spacing: -0.045em;
    margin-left: -0.06em;
    white-space: nowrap;
    text-shadow: 0 0 60px rgb(166 220 255 / 0.18);
  }
  .sep {
    display: inline-block;
    color: var(--ice);
    opacity: 0.85;
    translate: 0 -0.07em;
    margin-inline: -0.03em;
  }
  .period {
    font-size: 0.32em;
    font-weight: 400;
    color: var(--text-2);
    margin-left: 0.15em;
  }
</style>
