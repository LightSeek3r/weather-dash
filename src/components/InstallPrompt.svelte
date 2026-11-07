<script lang="ts">
  import { onMount } from 'svelte'
  import {
    INSTALL_DELAY_MS,
    INSTALL_DISMISSED_KEY,
    dismissedRecently,
    installOffer,
    installed,
    isIosSafari
  } from '../lib/core/install'
  import { isStandalone } from '../lib/core/fullscreen'
  import { settingsStore } from '../lib/core/storage/settings'
  import { t } from '../lib/ui/strings'

  interface Props {
    /** Hold the banner back (start overlay up, or already fullscreen). */
    suppressed?: boolean
  }

  let { suppressed = false }: Props = $props()

  let s = $derived(t($settingsStore.locale).install)

  let eligible = $state(false) // not installed, not recently closed
  let ios = $state(false)
  let closed = $state(false)
  // The delay starts once the banner is no longer suppressed, so it never
  // pops up the instant the start overlay goes away.
  let waited = $state(false)

  let visible = $derived(
    eligible &&
      waited &&
      !suppressed &&
      !closed &&
      !$installed &&
      ($installOffer !== null || ios)
  )

  onMount(() => {
    let recent = false
    try {
      recent = dismissedRecently(
        localStorage.getItem(INSTALL_DISMISSED_KEY),
        Date.now()
      )
    } catch {
      // Storage can be blocked; the banner then shows once per page load at worst.
    }
    ios = isIosSafari(navigator)
    eligible = !isStandalone() && !recent
  })

  $effect(() => {
    if (suppressed || waited) return
    const timer = setTimeout(() => (waited = true), INSTALL_DELAY_MS)
    return () => clearTimeout(timer)
  })

  function remember(): void {
    closed = true
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }

  async function install(): Promise<void> {
    const event = $installOffer
    if (!event) return
    // An offer is single-use whatever the answer.
    installOffer.set(null)
    closed = true
    try {
      await event.prompt()
      const { outcome } = await event.userChoice
      if (outcome === 'dismissed') remember()
    } catch {
      /* the browser withdrew the offer */
    }
  }
</script>

{#if visible}
  <aside class="install" data-fx-calm aria-label={s.title}>
    <div class="install__text">
      <strong>{s.title}</strong>
      <p>
        {#if $installOffer}
          {s.body}
        {:else}
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path
              d="M10 12.5V3m0 0L6.8 6.2M10 3l3.2 3.2M5.5 9H4.8A1.3 1.3 0 0 0 3.5 10.3v5.4A1.3 1.3 0 0 0 4.8 17h10.4a1.3 1.3 0 0 0 1.3-1.3v-5.4A1.3 1.3 0 0 0 15.2 9h-.7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {s.ios}
        {/if}
      </p>
    </div>
    <div class="install__actions">
      {#if $installOffer}
        <button type="button" class="install__primary" onclick={install}>
          {s.action}
        </button>
      {/if}
      <button type="button" class="install__later" onclick={remember}>
        {s.dismiss}
      </button>
    </div>
  </aside>
{/if}

<style>
  /* Top centre: the bottom-right corner already holds the status dot and the
     gear/fullscreen buttons. */
  .install {
    position: fixed;
    top: max(var(--space-md, 1.5rem), env(safe-area-inset-top));
    inset-inline: max(var(--space-md, 1.5rem), env(safe-area-inset-left));
    z-index: 20;
    max-width: 34rem;
    margin-inline: auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    padding: 0.9rem 1.1rem;
    border-radius: var(--r);
    background: var(--glass);
    border: 1px solid var(--glass-edge);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(1.25)
      brightness(var(--glass-dim));
    backdrop-filter: blur(var(--glass-blur)) saturate(1.25)
      brightness(var(--glass-dim));
    color: var(--text);
    font-family: var(--text-font);
  }

  .install__text {
    flex: 1 1 14rem;
    min-width: 0;
  }

  strong {
    display: block;
    font-family: var(--display);
    font-weight: 400;
  }

  p {
    margin: 0.25rem 0 0;
    color: var(--text-2);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  p svg {
    width: 1.1em;
    height: 1.1em;
    vertical-align: -0.2em;
    margin-inline-end: 0.25em;
  }

  .install__actions {
    display: flex;
    gap: 0.5rem;
    margin-inline-start: auto;
  }

  button {
    min-height: 2.75rem;
    padding-inline: 1rem;
    border-radius: 999px;
    font: inherit;
    font-weight: 600;
    color: var(--text);
    background: transparent;
    border: 1px solid var(--glass-edge);
    cursor: pointer;
  }

  .install__primary {
    background: var(--ice);
    border-color: var(--ice);
    color: #0a1726;
  }

  button:focus-visible {
    outline: 2px solid var(--ice);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .install {
      animation: install-in 0.4s ease both;
    }
  }

  @keyframes install-in {
    from {
      opacity: 0;
      transform: translateY(-0.75rem);
    }
  }
</style>
