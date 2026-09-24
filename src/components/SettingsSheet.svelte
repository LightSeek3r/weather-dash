<script lang="ts">
  // Shell only — per-feature settings (weather units, holidays, photos, fx
  // quality, etc.) get their own section as each feature ships; this phase
  // just needs the open/close mechanics and a11y wiring in place so nothing
  // has to touch the sheet's container again.
  import { onDestroy } from 'svelte'
  import { settingsStore } from '../lib/core/storage/settings'
  import { t } from '../lib/ui/strings'

  interface Props {
    open: boolean
    onclose: () => void
  }

  let { open, onclose }: Props = $props()
  let closeButton: HTMLButtonElement | undefined = $state()
  let triggerToRestore: Element | null = null
  let s = $derived(t($settingsStore.locale))

  $effect(() => {
    if (open) {
      triggerToRestore = document.activeElement
      closeButton?.focus()
    } else if (triggerToRestore instanceof HTMLElement) {
      triggerToRestore.focus()
    }
  })

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onclose()
  }

  onDestroy(() => {
    if (triggerToRestore instanceof HTMLElement) triggerToRestore.focus()
  })
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
  <div
    class="sheet-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label={s.settings.title}
  >
    <div class="sheet">
      <header class="sheet__header">
        <h2>{s.settings.title}</h2>
        <button
          type="button"
          bind:this={closeButton}
          class="sheet__close"
          aria-label={s.settings.close}
          onclick={onclose}
        >
          ×
        </button>
      </header>
      <p class="sheet__placeholder">{s.settings.placeholder}</p>
    </div>
  </div>
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    justify-content: flex-end;
    background: rgb(10 23 38 / 0.55);
  }

  .sheet {
    width: min(28rem, 100vw);
    height: 100%;
    padding: var(--space-md, 1.5rem);
    background: var(--color-glass, rgba(196, 222, 255, 0.09));
    border-inline-start: 1px solid
      var(--color-glass-edge, rgba(222, 238, 255, 0.18));
    backdrop-filter: blur(24px) saturate(1.25);
    -webkit-backdrop-filter: blur(24px) saturate(1.25);
    color: var(--color-text, #eef4fb);
    font-family: var(--font-body, sans-serif);
    overflow-y: auto;
  }

  .sheet__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md, 1.5rem);
  }

  .sheet__header h2 {
    margin: 0;
    font-family: var(--display, inherit);
    font-weight: 300;
  }

  .sheet__close {
    background: transparent;
    border: none;
    color: var(--color-text, #eef4fb);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.2em 0.5em;
    border-radius: var(--radius-sm, 0.4rem);
  }

  .sheet__close:hover,
  .sheet__close:focus-visible {
    background: var(--color-glass-hi, rgba(255, 255, 255, 0.1));
  }

  .sheet__placeholder {
    color: var(--color-text-2, rgba(238, 244, 251, 0.7));
    line-height: 1.5;
  }
</style>
