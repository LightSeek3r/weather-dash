<script lang="ts">
  /**
   * Renderless: publishes the anti-burn-in drift (lib/core/pixel-shift.ts)
   * as `--pixel-shift-x/-y` on the root element, which Layout.svelte's
   * `.page` reads — same root-custom-property handoff Background.svelte
   * uses for `--photo-scrim`. Only the content grid moves; the fixed
   * background layers stay put so no edge strip is ever uncovered.
   *
   * Not gated on reduced motion: a 1px step every few minutes is not
   * perceptible motion, and skipping it would drop burn-in protection.
   */
  import { onDestroy } from 'svelte'
  import { createPixelShift } from '../lib/core/pixel-shift'

  const shift = createPixelShift()
  const root = document.documentElement
  const unsubscribe = shift.offset.subscribe(({ x, y }) => {
    root.style.setProperty('--pixel-shift-x', `${x}px`)
    root.style.setProperty('--pixel-shift-y', `${y}px`)
  })

  onDestroy(() => {
    unsubscribe()
    shift.destroy()
    root.style.removeProperty('--pixel-shift-x')
    root.style.removeProperty('--pixel-shift-y')
  })
</script>
