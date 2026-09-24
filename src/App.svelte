<script lang="ts">
  import { registerSW } from 'virtual:pwa-register'
  import { onMount, onDestroy } from 'svelte'
  import Layout from './components/Layout.svelte'
  import HeroClock from './components/HeroClock.svelte'
  import DateLine from './components/DateLine.svelte'
  import { startKiosk, watchVisibilityForWakeLock } from './lib/core/fullscreen'

  registerSW()

  // Fullscreen requires a user gesture on most browsers (and iOS Safari has
  // no Fullscreen API at all), so the dashboard starts behind a "tap to
  // start" overlay rather than requesting it unprompted on load.
  let started = $state(false)
  let stopWatchingVisibility: (() => void) | undefined

  onMount(() => {
    stopWatchingVisibility = watchVisibilityForWakeLock()
  })
  onDestroy(() => stopWatchingVisibility?.())

  async function handleStart() {
    await startKiosk()
    started = true
  }
</script>

<Layout>
  {#snippet hero()}
    <HeroClock />
    <DateLine />
  {/snippet}
</Layout>

{#if !started}
  <button type="button" class="start-overlay" onclick={handleStart}>
    <span class="glass">Tap to start</span>
  </button>
{/if}

<style>
  .start-overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: rgb(10 23 38 / 0.55);
    border: none;
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
  .start-overlay .glass {
    padding: 1em 1.6em;
    border-radius: var(--r);
    background: var(--glass);
    border: 1px solid var(--glass-edge);
    -webkit-backdrop-filter: blur(22px) saturate(1.25);
    backdrop-filter: blur(22px) saturate(1.25);
    font-family: var(--display);
    font-size: var(--fs-l);
    font-weight: 300;
  }
  .start-overlay:focus-visible {
    outline: 2px solid var(--ice);
    outline-offset: -2px;
  }
</style>
