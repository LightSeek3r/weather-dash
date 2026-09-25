<script lang="ts">
  /**
   * Fills Layout.svelte's `data-bg-slot="photo"` element (projected in via
   * its `bg` snippet prop) with the current rotation photo, crossfaded with
   * a slow Ken Burns pan/zoom. Renders nothing when there are no photos —
   * Layout's own gradient-sky `.bg-sky` layer is already the correct
   * fallback (plan decision), this component must not obscure it.
   *
   * Object URL lifecycle (plan premortem P2 — named leak risk for a 24/7
   * kiosk): a URL is created only when a photo becomes a rendered layer and
   * revoked as soon as that layer is superseded or this component unmounts.
   * Never more than the currently-fading-in/out pair exist at once.
   */
  import { onDestroy, untrack } from 'svelte'
  import { settingsStore } from '../lib/core/storage/settings'
  import { listPhotos } from '../lib/photos/store'
  import { createPhotoRotation, ROTATION_MS } from '../lib/photos/rotation'
  import { photosChanged } from '../lib/photos/notify'
  import type { StoredPhoto } from '../lib/photos/types'

  interface Layer {
    key: string
    url: string
    visible: boolean
    kbTx: number
    kbTy: number
    kbScale: number
  }

  // Must stay well under the shortest rotation duration (1 minute) — this is
  // a transition between two photos, not the display duration itself.
  const CROSSFADE_MS = 1200

  let photos = $state<StoredPhoto[]>([])
  let layers = $state<Layer[]>([])
  let osReducedMotion = $state(false)

  let effectiveReducedMotion = $derived(
    $settingsStore.reducedMotion === 'on'
      ? true
      : $settingsStore.reducedMotion === 'off'
        ? false
        : osReducedMotion
  )
  let durationMs = $derived(ROTATION_MS[$settingsStore.photos.rotationDuration])
  let shuffle = $derived($settingsStore.photos.shuffle)
  let dimOpacity = $derived($settingsStore.photos.dimOpacity)
  let blurPx = $derived($settingsStore.photos.blurPx)

  function setPhotoAttr(on: boolean): void {
    if (typeof document === 'undefined') return
    if (on) document.documentElement.setAttribute('data-photo', '')
    else document.documentElement.removeAttribute('data-photo')
  }

  // Layout.svelte's [data-photo] scrim is the photo's dim layer.
  $effect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.style.setProperty(
      '--photo-scrim',
      String(dimOpacity)
    )
  })

  /** Random pan direction/magnitude per photo so the drift isn't identical every cycle (spec: subtle, ambient, not distracting). */
  function randomKenBurns(): { kbTx: number; kbTy: number; kbScale: number } {
    const angle = Math.random() * Math.PI * 2
    const magnitude = 2 + Math.random() * 2 // 2-4% translate drift
    return {
      kbTx: Math.round(Math.cos(angle) * magnitude * 100) / 100,
      kbTy: Math.round(Math.sin(angle) * magnitude * 100) / 100,
      kbScale: 1.06 + Math.random() * 0.02 // 106%-108% (spec: ~100%->108%)
    }
  }

  function addLayer(photo: StoredPhoto): void {
    // Snapshot of layers this one is superseding — captured now so the
    // removal below only ever targets *these* specific keys, never whatever
    // happens to be in `layers` by the time the timeout fires (avoids a
    // race where a later, unrelated layer gets pruned by an old callback).
    const supersededKeys = layers.map((l) => l.key)
    const layer: Layer = {
      key: `${photo.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url: URL.createObjectURL(photo.blob),
      visible: false,
      ...randomKenBurns()
    }
    layers = [...layers, layer]
    setPhotoAttr(true)

    const reveal = (): void => {
      layers = layers.map((l) =>
        l.key === layer.key ? { ...l, visible: true } : l
      )
    }
    const removeSuperseded = (): void => {
      const toRemove = layers.filter((l) => supersededKeys.includes(l.key))
      for (const l of toRemove) URL.revokeObjectURL(l.url)
      layers = layers.filter((l) => !supersededKeys.includes(l.key))
    }

    if (effectiveReducedMotion) {
      // Hard cut, no dual-layer crossfade — matches Layout.svelte's own
      // prefers-reduced-motion pattern of dropping the animation outright.
      reveal()
      removeSuperseded()
      return
    }
    // Next frame so the opacity transition actually runs (mounting already
    // at opacity:1 would skip straight past it, no visible fade).
    requestAnimationFrame(reveal)
    setTimeout(removeSuperseded, CROSSFADE_MS + 50)
  }

  function clearLayers(): void {
    for (const l of layers) URL.revokeObjectURL(l.url)
    layers = []
    setPhotoAttr(false)
  }

  async function refreshPhotos(): Promise<void> {
    photos = await listPhotos()
  }

  // Owns the rotation lifecycle: (re)created whenever the photo list,
  // rotation duration, or shuffle setting changes; always torn down first
  // via the returned cleanup. No setInterval of our own here — durationMs
  // ticking is entirely `createPhotoRotation`'s job (backed by the shared
  // scheduler), this effect only reacts to its `current` store.
  //
  // `untrack()` around every addLayer/clearLayers call below is required,
  // not decorative: those functions both read and write `layers` (and
  // addLayer reads `effectiveReducedMotion`). Called synchronously inside
  // this effect (subscribe() fires its callback immediately), an untracked
  // read+write of the same state Svelte is still busy tracking is exactly
  // Svelte 5's "effect reads and writes the same piece of state" infinite
  // loop — confirmed live via effect_update_depth_exceeded before this fix.
  $effect(() => {
    const list = photos
    const duration = durationMs
    const doShuffle = shuffle

    if (list.length === 0) {
      untrack(clearLayers)
      return
    }

    const rotation = createPhotoRotation(list, duration, doShuffle)
    const unsubscribe = rotation.current.subscribe((photo) => {
      untrack(() => {
        if (photo) addLayer(photo)
        else clearLayers()
      })
    })

    return () => {
      unsubscribe()
      rotation.destroy()
    }
  })

  $effect(() => {
    void refreshPhotos()
    const unsubscribe = photosChanged.subscribe(() => void refreshPhotos())
    return unsubscribe
  })

  $effect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    osReducedMotion = media.matches
    const onChange = (e: MediaQueryListEvent): void => {
      osReducedMotion = e.matches
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  })

  onDestroy(() => {
    clearLayers()
  })
</script>

{#each layers as layer (layer.key)}
  <img
    src={layer.url}
    alt=""
    aria-hidden="true"
    class="photo-layer"
    class:visible={layer.visible}
    class:no-motion={effectiveReducedMotion}
    style="--kb-tx: {layer.kbTx}%; --kb-ty: {layer.kbTy}%; --kb-scale: {layer.kbScale}; --kb-duration: {durationMs}ms; filter: blur({blurPx}px);"
  />
{/each}

<style>
  .photo-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 1.2s linear;
    animation: kenburns var(--kb-duration) linear forwards;
  }
  .photo-layer.visible {
    opacity: 1;
  }
  .photo-layer.no-motion {
    transition: none;
    animation: none;
  }

  @keyframes kenburns {
    from {
      transform: scale(1) translate(0, 0);
    }
    to {
      transform: scale(var(--kb-scale, 1.08))
        translate(var(--kb-tx, 2%), var(--kb-ty, -2%));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .photo-layer {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
