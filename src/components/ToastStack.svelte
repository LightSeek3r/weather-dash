<script lang="ts">
  import { toasts, dismiss, type Toast } from '../lib/ui/toast'

  function roleFor(kind: Toast['kind']): 'alert' | 'status' {
    return kind === 'error' ? 'alert' : 'status'
  }

  function labelFor(t: Toast): string {
    return t.count > 1 ? `${t.message} (×${t.count})` : t.message
  }
</script>

<!--
  TODO: confirm token names once design-tokens.css lands — falls back to
  sensible dusk-palette values so this looks reasonable standalone.
-->
<div class="toast-stack" aria-live="polite">
  {#each $toasts as t (t.id)}
    <div class="toast toast--{t.kind}" role={roleFor(t.kind)}>
      <span class="toast__icon" aria-hidden="true">
        {#if t.kind === 'error'}!{:else if t.kind === 'success'}✓{:else}i{/if}
      </span>
      <span class="toast__message">{labelFor(t)}</span>
      <button
        type="button"
        class="toast__dismiss"
        aria-label="Dismiss notification"
        onclick={() => dismiss(t.id)}
      >
        ×
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-stack {
    position: fixed;
    inset-inline-end: var(--space-md, 1rem);
    inset-block-end: var(--space-md, 1rem);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm, 0.5rem);
    z-index: 1000;
    pointer-events: none;
    max-width: min(28rem, calc(100vw - 2rem));
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--space-sm, 0.6rem);
    padding: var(--space-sm, 0.75rem) var(--space-md, 1rem);
    border-radius: var(--radius-md, 0.9rem);
    background: var(--color-glass, rgba(196, 222, 255, 0.09));
    border: 1px solid var(--color-glass-edge, rgba(222, 238, 255, 0.18));
    box-shadow:
      inset 0 1px 0 var(--color-glass-hi, rgba(255, 255, 255, 0.1)),
      0 20px 40px -20px rgba(0, 8, 20, 0.6);
    backdrop-filter: blur(16px);
    color: var(--color-text, #eef4fb);
    font-family: var(--font-body, 'Atkinson Hyperlegible', sans-serif);
    font-size: var(--font-size-md, 0.95rem);
    animation: toast-in 0.25s
      var(--ease-standard, cubic-bezier(0.16, 1, 0.3, 1));
  }

  .toast__icon {
    flex: none;
    width: 1.5em;
    height: 1.5em;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-size: 0.8em;
    font-weight: 700;
  }

  .toast--info .toast__icon {
    background: var(--color-accent, #a6dcff);
    color: var(--color-bg, #0a0a0f);
  }

  .toast--success .toast__icon {
    background: var(--color-success, #8ce8b0);
    color: var(--color-bg, #0a0a0f);
  }

  .toast--error .toast__icon {
    background: var(--color-error, #ff8a8a);
    color: var(--color-bg, #0a0a0f);
  }

  .toast__message {
    flex: 1;
    line-height: 1.3;
  }

  .toast__dismiss {
    flex: none;
    background: transparent;
    border: none;
    color: var(--color-text-2, rgba(238, 244, 251, 0.7));
    font-size: 1.1em;
    line-height: 1;
    cursor: pointer;
    padding: 0.2em 0.4em;
    border-radius: var(--radius-sm, 0.4rem);
  }

  .toast__dismiss:hover,
  .toast__dismiss:focus-visible {
    color: var(--color-text, #eef4fb);
    background: var(--color-glass-hi, rgba(255, 255, 255, 0.1));
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
