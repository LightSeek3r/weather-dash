<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { scheduler } from '../lib/core/scheduler'

  interface Props {
    /** 24h format when false (default), 12h with AM/PM when true. */
    hour12?: boolean
    /** Append a running seconds readout. */
    showSeconds?: boolean
  }

  let { hour12 = false, showSeconds = false }: Props = $props()

  let now = $state(new Date())
  let unsubscribe: (() => void) | undefined

  onMount(() => {
    unsubscribe = scheduler.on('second', (tickNow) => {
      now = tickNow
    })
  })
  onDestroy(() => unsubscribe?.())

  let formatter = $derived(
    new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: showSeconds ? '2-digit' : undefined,
      hour12
    })
  )

  // formatToParts (not manual string concatenation) so the colon separator
  // can be styled on its own and 12h locales' AM/PM literal renders correctly.
  let parts = $derived(formatter.formatToParts(now))
</script>

<time class="clock" datetime={now.toISOString()}>
  {#each parts as part (part.type + part.value)}
    {#if part.type === 'literal'}
      <span class="sep">{part.value}</span>
    {:else if part.type === 'dayPeriod'}
      <span class="period">{part.value}</span>
    {:else}
      {part.value}
    {/if}
  {/each}
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
