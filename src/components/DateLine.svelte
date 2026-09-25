<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { scheduler } from '../lib/core/scheduler'
  import { dayOfYear, isoWeek } from '../lib/date/week'
  import { settingsStore } from '../lib/core/storage/settings'
  import { localeTag } from '../lib/ui/i18n'
  import { t } from '../lib/ui/strings'
  import { loadHolidays, type HolidaysModule } from '../lib/date/holidaysLazy'
  import { getSaintOfDay, type SaintTradition } from '../lib/date/saints'
  import { debugParams } from '../lib/core/debug-params'

  // `?freeze=1`/`?now=` (see lib/core/debug-params.ts): seed the frozen
  // instant directly since scheduler.start() is skipped while frozen.
  let now = $state(debugParams.now ?? new Date())
  let unsubscribe: (() => void) | undefined
  let holidaysApi = $state<HolidaysModule | null>(null)

  onMount(() => {
    // Minute resolution is enough for a date line; avoids 3600 useless
    // re-renders/hour that a `second` subscription here would cost.
    unsubscribe = scheduler.on('minute', (tickNow) => {
      now = tickNow
    })
    // See holidaysLazy.ts: keeps date-holidays' large bundled dataset out of
    // the eagerly-parsed app chunk.
    void loadHolidays().then((m) => {
      holidaysApi = m
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

  // Render every part in the order Intl itself produces, not a hand-picked
  // Western "weekday, day, month, year" order with literals dropped — that
  // hand-picked order happens to work for space-separated European
  // languages, but is wrong for zh (year-month-day order, with 年/月/日
  // *separator* characters carried as `literal` parts this discarded, so
  // "25 9 2026" rendered with no separators and in the wrong order instead
  // of "2026年9月25日"). `HeroClock.svelte` already renders all parts in
  // natural order for the same reason; this follows that precedent instead
  // of reintroducing the same class of bug in a second component.
  let dateParts = $derived(dateFormatter.formatToParts(now))
  let week = $derived(isoWeek(now))
  let doy = $derived(dayOfYear(now))
  // Reuses dayOfYear itself for "days in this year" instead of a separate
  // leap-year check — Dec 31 is always the last day of its own year.
  let daysInYear = $derived(dayOfYear(new Date(now.getFullYear(), 11, 31)))
  let s = $derived(t($settingsStore.locale))

  let saintName = $derived(
    $settingsStore.saints.enabled
      ? getSaintOfDay(
          now,
          $settingsStore.saints.tradition as SaintTradition,
          $settingsStore.locale
        )
      : null
  )
  let todaysHolidays = $derived(
    holidaysApi
      ? holidaysApi.getTodayHolidays(
          now,
          $settingsStore.holidays,
          $settingsStore.locale
        )
      : []
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
  {#each dateParts as part, i (i + part.type)}
    {#if part.type === 'year'}
      <span>{part.value}</span>
    {:else}
      {part.value}
    {/if}
  {/each}
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
