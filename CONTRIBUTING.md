# Contributing to Weather Dash

Thanks for taking an interest. Weather Dash is a small, one-person project, so the process is light.

## Reporting a problem

- **A bug or an idea:** open an [issue](https://github.com/LightSeek3r/weather-dash/issues/new/choose)
  and pick the matching template. For a layout bug, include the screen size or resolution and, if
  you can, a screenshot: the app is built to never hide or overlap information on any screen.
- **A wrong or clumsy translation:** use the *Translation problem* template with the language, the
  text as shown and what it should say. All 15 languages live in `src/lib/ui/strings.ts`.
- **A security problem:** do not use an issue. See [SECURITY.md](SECURITY.md).

## Running it locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Debug URL parameters make states reproducible: `?freeze=1`, `?now=2026-01-15T12:00:00`,
`?weather=clear-day|clear-night|rain|snow|fog|storm` and `?update=1` (shows the "new version"
invitation without a real service worker).

## Sending a pull request

1. Open an issue first for anything larger than a fix, so we agree on the direction.
2. Branch from `main`, keep the change small and focused.
3. Run the checks CI runs:

   ```bash
   npm run lint       # ESLint
   npm run check      # svelte-check, 0 errors is the bar
   npm test           # unit tests (Vitest)
   npm run test:e2e   # Playwright; npx playwright install chromium first
   ```

4. Put the reason in the PR description. For UI changes, add before/after screenshots, including
   one on a small screen if you touched the layout.

### House rules

- **LF line endings** everywhere (`.gitattributes` enforces it); `npx prettier --write <files>`
  after a bulk edit.
- **No third-party requests** from the app beyond Open-Meteo and Nominatim, and nothing that
  leaves the user's device: settings and photos stay local.
- **Never lose content to a small screen.** Rearrange or resize; do not hide, clip or overlap
  information.
- **Add a library only if it is needed**, and check `package.json` for an existing one first.
- **Comments say why, not what.** Add a test for logic you touch.
- **Visual baselines** (`tests/visual`) are per-OS and not committed; generate yours with
  `npx playwright test --project=visual --update-snapshots`.

By contributing you agree that your contribution is released under the [MIT licence](LICENSE).
This project follows the [Code of Conduct](CODE_OF_CONDUCT.md): be kind.
