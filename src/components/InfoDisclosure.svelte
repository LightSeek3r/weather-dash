<script lang="ts">
  // Shared tap-to-reveal popover: extracts the toggle/outside-click/Escape
  // mechanics StatusPill.svelte implemented first (dot + status text) so the
  // moon, holiday, and saint info affordances don't each reimplement it.
  import { tick, type Snippet } from 'svelte'
  import { t } from '../lib/ui/strings'
  import { settingsStore } from '../lib/core/storage/settings'

  interface Props {
    trigger: Snippet
    content: Snippet
    label?: string
    placement?: 'above' | 'below'
    align?: 'start' | 'end'
  }

  let {
    trigger,
    content,
    label,
    placement = 'below',
    align = 'start'
  }: Props = $props()

  let s = $derived(t($settingsStore.locale))
  let ariaLabel = $derived(label ?? s.common.moreInfo)

  /** Keep-clear distance between the popover and the viewport edge, px. */
  const EDGE = 8

  let open = $state(false)
  let rootEl: HTMLDivElement | undefined
  let popEl: HTMLDivElement | undefined = $state()

  // Collision handling: the popover opens on its preferred side, then flips
  // to the roomier side, slides back inside the viewport horizontally and,
  // only when neither side fits it, scrolls inside a capped height — it is
  // never cropped by a screen edge, whatever the resolution.
  let flipped = $state(false)
  let shiftX = $state(0)
  let maxHeight = $state<number | null>(null)
  let side = $derived((placement === 'above') !== flipped ? 'above' : 'below')

  async function place(): Promise<void> {
    flipped = false
    shiftX = 0
    maxHeight = null
    await tick()
    if (!popEl || !rootEl) return
    const p = popEl.getBoundingClientRect()
    const t = rootEl.getBoundingClientRect()
    const above = placement === 'above'
    const gap = above ? t.top - p.bottom : p.top - t.bottom
    const roomAbove = t.top - gap - EDGE
    const roomBelow = window.innerHeight - t.bottom - gap - EDGE
    const preferred = above ? roomAbove : roomBelow
    const other = above ? roomBelow : roomAbove
    if (p.height > preferred) {
      flipped = other > preferred
      const room = Math.max(preferred, other)
      if (p.height > room) maxHeight = Math.max(0, room)
    }
    if (p.left < EDGE) shiftX = EDGE - p.left
    else if (p.right > window.innerWidth - EDGE) {
      shiftX = window.innerWidth - EDGE - p.right
    }
  }

  function toggle(): void {
    open = !open
  }

  function handlePointerDown(e: PointerEvent): void {
    if (rootEl && !rootEl.contains(e.target as Node)) open = false
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') open = false
  }

  $effect(() => {
    if (!open) return
    void place()
    const onResize = (): void => void place()
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('resize', onResize)
    }
  })
</script>

<div class="info-disclosure" bind:this={rootEl}>
  <button
    type="button"
    class="info-disclosure__trigger"
    aria-label={ariaLabel}
    aria-haspopup="true"
    aria-expanded={open}
    onclick={toggle}
  >
    {@render trigger()}
  </button>
  {#if open}
    <div
      bind:this={popEl}
      class="info-disclosure__popover"
      class:info-disclosure__popover--above={side === 'above'}
      class:info-disclosure__popover--end={align === 'end'}
      style:transform={shiftX ? `translateX(${shiftX}px)` : undefined}
      style:max-height={maxHeight === null ? undefined : `${maxHeight}px`}
      style:overflow-y={maxHeight === null ? undefined : 'auto'}
    >
      {@render content()}
    </div>
  {/if}
</div>

<style>
  .info-disclosure {
    position: relative;
    display: inline-flex;
  }

  .info-disclosure__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: inherit;
    cursor: pointer;
  }

  .info-disclosure__popover {
    position: absolute;
    top: calc(100% + var(--space-sm, 0.6rem));
    left: 0;
    z-index: 1;
    min-width: min(12em, calc(100vw - 2 * 8px));
    max-width: min(22em, calc(100vw - 2 * 8px));
    margin: 0;
    padding: 0.6em 0.9em;
    border-radius: var(--radius-md, 1rem);
    /* Solid enough to read over bright FX (bright sun/lightning) behind it —
       the shared low-opacity `--color-glass` tint the big panels use relies
       on their own 22px blur to stay legible; this floats free-standing over
       whatever's behind it, so it needs a background closer to
       SettingsSheet's own solid-ish `rgb(9 20 34 / 0.92)` sheet header. */
    background: rgb(9 20 34 / 0.92);
    border: 1px solid var(--color-glass-edge, rgba(222, 238, 255, 0.18));
    color: var(--color-text-2, rgba(238, 244, 251, 0.75));
    font-family: var(--font-body, 'Atkinson Hyperlegible', sans-serif);
    font-size: var(--font-size-sm, 0.85rem);
    line-height: 1.4;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .info-disclosure__popover--above {
    top: auto;
    bottom: calc(100% + var(--space-sm, 0.6rem));
  }
  .info-disclosure__popover--end {
    left: auto;
    right: 0;
  }
</style>
