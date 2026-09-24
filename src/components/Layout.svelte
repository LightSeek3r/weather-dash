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
  }

  let { hero, cap, tl, tm }: Props = $props()
</script>

<!--
  Background stack, back to front: gradient sky, a slot phase 4 (photos)
  drops a rotating <img> into, and a scrim that keeps text readable over
  either. The slot exists now (even though it's empty) so later work never
  has to touch this layout to wire a background image in.
-->
<div class="layer bg-photo" data-bg-slot="photo" aria-hidden="true"></div>
<div class="layer bg-sky" aria-hidden="true"></div>
<div class="layer scrim" aria-hidden="true"></div>

<main class="page">
  {#if hero}
    <section class="hero" aria-label="Time and date">
      {@render hero()}
    </section>
  {/if}
  {#if cap}
    <section class="cap glass" aria-label="Current weather">
      {@render cap()}
    </section>
  {/if}
  {#if tl}
    <section class="tl glass" aria-label="Next 24 hours">
      {@render tl()}
    </section>
  {/if}
  {#if tm}
    <footer class="tm" aria-label="Tomorrow">
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
    background: linear-gradient(
      178deg,
      var(--sky-0) 0%,
      var(--sky-1) 52%,
      var(--sky-2) 100%
    );
    overflow: hidden;
  }
  /* Two slow light pools: street glow low-left, cold sky high-right. */
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
    background: radial-gradient(
      circle,
      rgb(255 150 118 / 0.16),
      transparent 62%
    );
  }
  .bg-sky::after {
    right: -40vmax;
    top: -50vmax;
    background: radial-gradient(
      circle,
      rgb(92 170 210 / 0.14),
      transparent 60%
    );
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
  :global([data-photo]) .scrim {
    opacity: 1;
    background: radial-gradient(
      120% 90% at 30% 35%,
      rgb(10 23 38 / 0.89),
      rgb(10 23 38 / 0.94)
    );
    -webkit-backdrop-filter: blur(6px) saturate(0.85);
    backdrop-filter: blur(6px) saturate(0.85);
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
  .tl {
    grid-area: tl;
    padding: calc(var(--u) * 1.4) calc(var(--u) * 2.2) calc(var(--u) * 1.2);
  }
  .tm {
    grid-area: tm;
    display: flex;
    align-items: center;
    gap: calc(var(--u) * 2);
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
