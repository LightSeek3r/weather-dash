<script lang="ts">
  import { registerSW } from 'virtual:pwa-register'

  registerSW()
</script>

<main>
  <h1>Wall Dashboard</h1>
  <p>Foundation phase scaffolding complete.</p>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #0a0a0f;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, sans-serif;
  }

  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }

  h1 {
    font-size: 2rem;
    margin: 0 0 1rem 0;
  }

  p {
    font-size: 1rem;
    margin: 0;
  }
</style>
