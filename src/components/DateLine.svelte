<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { scheduler } from '../lib/core/scheduler'
  import { dayOfYear, isoWeek } from '../lib/date/week'

  let now = $state(new Date())
  let unsubscribe: (() => void) | undefined

  onMount(() => {
    // Minute resolution is enough for a date line; avoids 3600 useless
    // re-renders/hour that a `second` subscription here would cost.
    unsubscribe = scheduler.on('minute', (tickNow) => {
      now = tickNow
    })
  })
  onDestroy(() => unsubscribe?.())

  let dateFormatter = $derived(
    new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  )

  function partsOf(date: Date, formatter: Intl.DateTimeFormat) {
    const out: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
    for (const part of formatter.formatToParts(date)) {
      out[part.type] = part.value
    }
    return out
  }

  let dateParts = $derived(partsOf(now, dateFormatter))
  let week = $derived(isoWeek(now))
  let doy = $derived(dayOfYear(now))
  // Reuses dayOfYear itself for "days in this year" instead of a separate
  // leap-year check — Dec 31 is always the last day of its own year.
  let daysInYear = $derived(dayOfYear(new Date(now.getFullYear(), 11, 31)))
</script>

<p class="date">
  {dateParts.weekday}
  {dateParts.day}
  {dateParts.month}
  <span>{dateParts.year}</span>
</p>
<ul class="meta">
  <li>Week <b>{week}</b></li>
  <li>Day <b>{doy}</b> of {daysInYear}</li>
  <li class="placeholder">
    <!-- TODO phase 3: real saint-of-the-day data (bundled JSON per tradition, see plan P11) -->
    <b>—</b>
  </li>
  <li class="placeholder">
    <!-- TODO phase 3: real holiday data (date-holidays wrapper, country/region + toggles) -->
    <b>—</b>
  </li>
</ul>

<style>
  .date {
    margin-top: calc(var(--u) * 1.6);
    font-family: var(--display);
    font-size: var(--fs-xl);
    font-weight: 300;
    letter-spacing: -0.01em;
  }
  .date span {
    color: var(--text-2);
  }
  .meta {
    list-style: none;
    margin: calc(var(--u) * 1.4) 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--u) * 0.8) calc(var(--u) * 2.4);
    font-size: var(--fs-m);
    color: var(--text-2);
  }
  .meta li {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
  }
  .meta b {
    color: var(--text);
    font-weight: 700;
  }
  .meta .placeholder b {
    color: var(--text-3);
    font-weight: 400;
  }
</style>
