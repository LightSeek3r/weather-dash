<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    /** Clock + date line (phase 1). */
    hero?: Snippet
    /** Current-conditions capsule (phase 2). */
    cap?: Snippet
    /** 24h timeline band (phase 2). */
    tl?: Snippet
    /** Tomorrow strip (phase 2). */
    tm?: Snippet
    /** Rotating photo background (phase 4) — projected into the bg-photo slot below. */
    bg?: Snippet
    /** Sun/moon on its arc (CelestialArc) — projected into the bg-celestial layer below. */
    sky?: Snippet
  }

  let { hero, cap, tl, tm, bg, sky }: Props = $props()
</script>

<!--
  Background stack, back to front: gradient sky, a slot phase 4 (photos)
  drops a rotating <img> into, and a scrim that keeps text readable over
  either. The slot exists now (rendering the `bg` snippet, empty when no
  Background component is passed) so later work never has to touch this
  layout to wire a background image in.

  Full stacking order (z-index; same z paints in DOM order):
    0  .bg-photo      rotating photo (bg slot)
    1  .bg-sky        gradient sky, transparent while a photo shows
    2  .scrim         readability dim (the photo dim slider)
    2  .bg-celestial  sun/moon (sky slot) — after .scrim in the DOM, so the
                      photo dim never mutes the sun; it's a light source,
                      not part of the picture
    3  .border-fx     weather FX (BorderFx.svelte, mounted by App) — veils
                      the sun/moon in bad weather, stays quiet behind the
                      `data-fx-calm` regions below (lib/fx/calm-zones.ts)
    4  .page          text and glass; nothing below may ever cover it
  Overlays above the page (gear/status 5, fullscreen scene 8, night dim 9,
  start overlay 10, settings 20, toasts 1000) live in their own components.
-->
<div class="layer bg-photo" data-bg-slot="photo" aria-hidden="true">
  {#if bg}
    {@render bg()}
  {/if}
</div>
<div class="layer bg-sky" aria-hidden="true"></div>
<div class="layer scrim" aria-hidden="true"></div>
<div class="layer bg-celestial" aria-hidden="true">
  {#if sky}
    {@render sky()}
  {/if}
</div>

<main class="page">
  {#if hero}
    <section class="hero" aria-label="Time and date" data-fx-calm="text">
      {@render hero()}
    </section>
  {/if}
  {#if cap}
    <section
      class="cap glass"
      aria-label="Current weather"
      data-fx-calm="glass"
    >
      {@render cap()}
    </section>
  {/if}
  {#if tl}
    <section class="tl glass" aria-label="Next 24 hours" data-fx-calm="glass">
      {@render tl()}
    </section>
  {/if}
  {#if tm}
    <footer class="tm" aria-label="Tomorrow" data-fx-calm="text">
      {@render tm()}
    </footer>
  {/if}
</main>

<style>
  .layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
  }

  .bg-photo {
    z-index: 0;
    background: center / cover no-repeat;
  }

  .bg-sky {
    z-index: 1;
    background:
      radial-gradient(55% 50% at 12% 15%, var(--field-high), transparent),
      radial-gradient(60% 50% at 55% 105%, var(--field-low), transparent),
      linear-gradient(
        180deg,
        var(--sky-0) 0%,
        var(--sky-1) 50%,
        var(--sky-2) 100%
      );
    overflow: hidden;
    transition: opacity 0.6s linear;
  }
  .bg-celestial {
    z-index: 2;
    overflow: hidden;
  }
  /* Opaque and above .bg-photo, so it must go when a photo shows. */
  :global([data-photo]) .bg-sky {
    opacity: 0;
  }
  /* Two slow light pools, low-left and high-right (colors per sky mood). */
  .bg-sky::before,
  .bg-sky::after {
    content: '';
    position: absolute;
    width: 90vmax;
    height: 90vmax;
    border-radius: 50%;
    animation: pool 90s ease-in-out infinite alternate;
  }
  .bg-sky::before {
    left: -35vmax;
    bottom: -55vmax;
    background: radial-gradient(circle, var(--pool-low), transparent 62%);
  }
  .bg-sky::after {
    right: -40vmax;
    top: -50vmax;
    background: radial-gradient(circle, var(--pool-high), transparent 60%);
    animation-delay: -45s;
  }
  @keyframes pool {
    from {
      transform: translate(0, 0) scale(1);
    }
    to {
      transform: translate(4vmax, -3vmax) scale(1.08);
    }
  }

  /* Alpha tuned for a pure-white photo, blended the way browsers actually
     blend (gamma-encoded sRGB), so text keeps >=4.5:1 (WCAG AA) over any
     image dropped into [data-bg-slot="photo"] later. */
  .scrim {
    z-index: 2;
    opacity: 0.25;
    background:
      radial-gradient(
        120% 90% at 30% 35%,
        rgb(10 23 38 / 0.7),
        rgb(10 23 38 / 0.82)
      ),
      linear-gradient(180deg, rgb(10 23 38 / 0.2), rgb(10 23 38 / 0.35));
  }
  /* The only dim over a photo: its strength is the user's dim slider
     (`--photo-scrim`, set by Background.svelte), slightly deeper behind the
     clock, which has no glass panel of its own. Stacking a fixed floor or a
     blur on top of the slider left photos barely visible at any setting. */
  :global([data-photo]) .scrim {
    opacity: 1;
    background: radial-gradient(
      120% 90% at 30% 35%,
      rgb(10 23 38 / min(1, calc(var(--photo-scrim, 0.55) + 0.1))),
      rgb(10 23 38 / var(--photo-scrim, 0.55))
    );
  }

  .page {
    position: relative;
    z-index: 4;
    height: 100dvh;
    padding: var(--pad) calc(var(--pad) * 1.2) calc(var(--pad) * 0.7);
    display: grid;
    grid-template-columns: minmax(0, 1fr) calc(var(--u) * 34);
    grid-template-rows: minmax(0, 1fr) auto auto;
    grid-template-areas: 'hero cap' 'tl tl' 'tm tm';
    gap: calc(var(--u) * 1.6) calc(var(--u) * 4);
    transform: translate(var(--pixel-shift-x, 0px), var(--pixel-shift-y, 0px));
  }

  @media (orientation: portrait) {
    .page {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) auto auto auto;
      grid-template-areas: 'hero' 'cap' 'tl' 'tm';
      padding-inline: var(--pad);
    }
  }

  .hero {
    grid-area: hero;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
  }
  .cap {
    grid-area: cap;
    padding: calc(var(--u) * 2.4);
    min-width: 0;
  }
  @media (max-height: 820px) {
    .cap {
      padding: calc(var(--u) * 1.7);
    }
  }
  /* Text floors (design-tokens.css) keep the cap's copy from shrinking with
     --u here, while the clock does; hand it the width the clock gave up. */
  @media (orientation: landscape) and (max-height: 520px) {
    .page {
      grid-template-columns: minmax(0, 1fr) calc(var(--u) * 46);
    }
  }
  .tl {
    grid-area: tl;
    padding: calc(var(--u) * 1.4) calc(var(--u) * 2.2) calc(var(--u) * 1.2);
  }
  /* Right padding keeps Tomorrow's own text clear of the fixed bottom-right
     corner cluster — StatusPill's dot (the corner itself) plus App's gear
     button one 3.25rem slot in from it; wraps rather than running off narrow
     phones. StatusPill itself is `position: fixed` now (not part of this
     row's flex flow), so this is sized for the cluster, not for "one item at
     the row's own end" like it used to be. */
  .tm {
    grid-area: tm;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: calc(var(--u) * 0.8) calc(var(--u) * 2);
    padding-right: 7.75rem;
  }
  /* …and of the fullscreen button, one more 3.25rem slot in, while App offers one. */
  :global(:root[data-fs-button]) .tm {
    padding-right: 11rem;
  }

  .glass {
    background: var(--glass);
    border: 1px solid var(--glass-edge);
    border-radius: var(--r);
    box-shadow:
      inset 0 1px 0 var(--glass-hi),
      0 30px 60px -30px rgb(0 8 20 / 0.6);
    -webkit-backdrop-filter: blur(22px) saturate(1.25);
    backdrop-filter: blur(22px) saturate(1.25);
  }

  @media (prefers-reduced-motion: reduce) {
    .bg-sky::before,
    .bg-sky::after {
      animation: none;
    }
  }
</style>
