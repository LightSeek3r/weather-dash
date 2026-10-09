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
  import { isPlaceholderLocationName } from '../lib/weather/locationName'
  import InfoDisclosure from './InfoDisclosure.svelte'

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
  // Two unbreakable groups — the weekday (with the separator next to it) and
  // the rest — so a line too narrow for both breaks between them, never
  // inside "15 January 2026". Weekday-first and weekday-last orders both exist.
  let dateGroups = $derived.by(() => {
    const parts = dateParts
    const first = parts[0]?.type === 'weekday'
    const last = parts.at(-1)?.type === 'weekday'
    if (first && parts[1]?.type === 'literal') {
      return [parts.slice(0, 2), parts.slice(2)]
    }
    if (last && parts.at(-2)?.type === 'literal') {
      return [parts.slice(0, -2), parts.slice(-2)]
    }
    return [parts]
  })
  let week = $derived(isoWeek(now))
  let doy = $derived(dayOfYear(now))
  // Reuses dayOfYear itself for "days in this year" instead of a separate
  // leap-year check — Dec 31 is always the last day of its own year.
  let daysInYear = $derived(dayOfYear(new Date(now.getFullYear(), 11, 31)))
  let s = $derived(t($settingsStore.locale))

  // An unnamed GPS fix ("Current location") says nothing worth showing.
  let place = $derived.by(() => {
    const name = $settingsStore.location?.name
    return name && !isPlaceholderLocationName(name) ? name : ''
  })

  let saintName = $derived(
    $settingsStore.saints.enabled
      ? getSaintOfDay(
          now,
          $settingsStore.saints.tradition as SaintTradition,
          $settingsStore.locale
        )
      : null
  )
  let saintTraditionLabel = $derived(
    $settingsStore.saints.tradition === 'french-civil'
      ? s.settings.saints.traditionFrenchCivil
      : s.settings.saints.traditionRomanCatholic
  )
  let todaysHolidays = $derived(
    holidaysApi
      ? holidaysApi.getHolidaysForDateAndSettings(
          now,
          $settingsStore.holidays,
          $settingsStore.locale
        )
      : []
  )
  // Compact date-line item, not a list view: show up to 2 names, then a
  // "+N" overflow marker rather than growing the line unbounded (e.g. two
  // extraCountries both landing on the same day). `public` is the library's
  // type for a day off work (its `bank` type is only banks closing).
  let shownHolidays = $derived(
    todaysHolidays
      .slice(0, 2)
      .map((h) => ({ name: h.name, bank: h.type === 'public' }))
  )
  let holidayOverflow = $derived(
    todaysHolidays.length > 2 ? s.dateLine.more(todaysHolidays.length - 2) : ''
  )
  // Untruncated per-holiday country/region breakdown for the info popover —
  // the compact line above stays as-is either way.
  let holidayOrigins = $derived(
    todaysHolidays.map((h) => {
      const country = holidaysApi
        ? holidaysApi.countryDisplayName(h.countryCode, $settingsStore.locale)
        : h.countryCode
      const region =
        h.regionCode && holidaysApi
          ? holidaysApi.regionDisplayName(
              h.countryCode,
              h.regionCode,
              $settingsStore.locale
            )
          : null
      return { name: h.name, origin: s.dateLine.holidayOrigin(country, region) }
    })
  )
</script>

<p class="date">
  {#each dateGroups as group, g (g)}<span class="group"
      >{#each group as part, i (i + part.type)}{#if part.type === 'year'}<span
            class="year">{part.value}</span
          >{:else}{part.value}{/if}{/each}</span
    >{/each}
</p>
<ul class="meta">
  {#if place}
    <li class="place">
      <svg class="pin" aria-hidden="true"><use href="#i-pin" /></svg><b
        >{place}</b
      >
    </li>
  {/if}
  <li>{s.dateLine.week} <b>{week}</b></li>
  <li>{s.dateLine.day} <b>{doy}</b> {s.dateLine.of} {daysInYear}</li>
  {#if saintName}
    <li>
      <b>{saintName}</b>
      <InfoDisclosure label={s.common.moreInfo} placement="above">
        {#snippet trigger()}
          <svg class="info-icon" aria-hidden="true"><use href="#i-info" /></svg>
        {/snippet}
        {#snippet content()}
          <p>{s.dateLine.saintSource(saintTraditionLabel)}</p>
        {/snippet}
      </InfoDisclosure>
    </li>
  {/if}
  {#if todaysHolidays.length > 0}
    <li>
      <b class="holidays"
        >{#each shownHolidays as h, i (i)}{#if i > 0}<span
              >,&nbsp;</span
            >{/if}<span class="holiday"
            >{#if h.bank}<svg
                class="bank-ic"
                role="img"
                aria-label={s.dateLine.bankHoliday}
              >
                <use href="#i-bank-holiday" /></svg
              >{/if}{h.name}</span
          >{/each}{#if holidayOverflow}&nbsp;{holidayOverflow}{/if}</b
      >
      <InfoDisclosure label={s.common.moreInfo} placement="above">
        {#snippet trigger()}
          <svg class="info-icon" aria-hidden="true"><use href="#i-info" /></svg>
        {/snippet}
        {#snippet content()}
          {#each holidayOrigins as h (h.name)}
            <p>{h.name} — {h.origin}</p>
          {/each}
        {/snippet}
      </InfoDisclosure>
    </li>
  {/if}
</ul>

<style>
  .date {
    /* Also drops the UA's 1em bottom margin, a whole blank line at this size. */
    margin: calc(var(--u) * 1.6) 0 0;
    font-family: var(--display);
    font-size: var(--fs-xl);
    font-weight: 300;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }
  /* break-spaces keeps the separator's trailing space as real width between
     the groups, yet still wraps inside a group too wide for any line. */
  .date .group {
    display: inline-block;
    max-width: 100%;
    white-space: break-spaces;
  }
  .date .year {
    color: var(--text-2);
  }
  .meta {
    list-style: none;
    margin: calc(var(--u) * 1.4) 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--u) * 0.8) calc(var(--u) * 2.4);
    font-size: max(17px, calc(var(--u) * 1.9));
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
  .info-icon {
    width: 0.9em;
    height: 0.9em;
    opacity: 0.6;
  }
  .holiday {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
  }
  .bank-ic {
    width: 1em;
    height: 1em;
    flex: none;
    color: var(--peach);
  }
  .meta .place {
    gap: 0.35em;
  }
  .pin {
    width: 1em;
    height: 1em;
    flex: none;
    color: var(--ice);
  }
  /* The info popover's content is authored here but renders inside
     InfoDisclosure — reset the UA default <p> margin the same way
     CurrentWeather.svelte already does for its own popover content. */
  :global(.info-disclosure__popover) p {
    margin: 0 0 0.3em;
  }
  :global(.info-disclosure__popover) p:last-child {
    margin-bottom: 0;
  }
</style>
