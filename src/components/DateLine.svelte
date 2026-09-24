<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { scheduler } from '../lib/core/scheduler'
  import { dayOfYear, isoWeek } from '../lib/date/week'
  import { settingsStore } from '../lib/core/storage/settings'
  import { localeTag } from '../lib/ui/i18n'
  import { t } from '../lib/ui/strings'
  import { getTodayHolidays } from '../lib/date/holidays'
  import { getSaintOfDay, type SaintTradition } from '../lib/date/saints'

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
    new Intl.DateTimeFormat(localeTag($settingsStore.locale), {
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
  let s = $derived(t($settingsStore.locale))

  let saintName = $derived(
    $settingsStore.saints.enabled
      ? getSaintOfDay(now, $settingsStore.saints.tradition as SaintTradition)
      : null
  )
  let todaysHolidays = $derived(
    getTodayHolidays(now, $settingsStore.holidays, $settingsStore.locale)
  )
  // Compact date-line item, not a list view: show up to 2 names, then a
  // "+N" overflow marker rather than growing the line unbounded (e.g. two
  // extraCountries both landing on the same day).
  let holidayDisplay = $derived.by(() => {
    const names = todaysHolidays.map((h) => h.name)
    if (names.length <= 2) return names.join(', ')
    return `${names.slice(0, 2).join(', ')} ${s.dateLine.more(names.length - 2)}`
  })
</script>

<p class="date">
  {dateParts.weekday}
  {dateParts.day}
  {dateParts.month}
  <span>{dateParts.year}</span>
</p>
<ul class="meta">
  <li>{s.dateLine.week} <b>{week}</b></li>
  <li>{s.dateLine.day} <b>{doy}</b> {s.dateLine.of} {daysInYear}</li>
  {#if saintName}
    <li><b>{saintName}</b></li>
  {/if}
  {#if todaysHolidays.length > 0}
    <li><b>{holidayDisplay}</b></li>
  {/if}
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
</style>
