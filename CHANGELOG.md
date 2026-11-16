# Changelog

All notable changes to Weather Dash are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org) loosely while the project is 0.x. Versions before 1.0.0
are tagged retroactively from the development history.

## [Unreleased]

## [1.0.0] - 2026-11-16

First public release. The app runs at <https://weather.unit42.fr>.

### Added

- **Update invitation.** When a newer version of the app is ready, the status dot in the bottom-right
  corner pulses and opens a card with a **Reload** button. It folds back into the dot after 30
  seconds and can be reopened by tapping the dot. The nightly 03:30 reload applies the update on
  its own, and an always-open tab checks for one every hour.
- **Outline condition icon** in the current-conditions tile (sun, moon, clouds, rain, snow, storm,
  fog), drawn as stroke-only art next to the filled icons used elsewhere.
- **Version and source link** at the bottom of the settings sheet.
- Open-source project files: MIT licence, contributing guide, code of conduct, security policy,
  issue and pull request templates, Dependabot, a CI workflow that also runs the Playwright
  suite, and a release workflow driven by this changelog.

### Changed

- The service worker no longer reloads the page by itself when a new build is ready
  (`registerType: 'prompt'`): the new version waits until you reload.
- The settings sheet has a darker, more opaque background, so the sun, rays and clouds behind it no
  longer bleed through the form text.
- The Playwright visual baselines are no longer committed (they were Windows-only and about 60 MB);
  generate yours with `npx playwright test --project=visual --update-snapshots`.

### Fixed

- Info popovers (air quality, moon phase, UV, wind, holiday and saint notes) are no longer cropped
  by the screen edge at any resolution: they flip to the roomier side, slide back inside the
  viewport and scroll only when neither side fits.
- A strip of bare sky between the near clouds and the glass cards, caused by the half-resolution
  front effects layer being cut out too wide.

## [0.13.0] - 2026-11-13

### Added

- **Install banner** and a richer web manifest (screenshots, categories, fullscreen display with a
  standalone fallback), so the app can be installed on phones, tablets and desktops (7 November).

### Fixed

- The front effects layer is cut around the cards' rounded corners instead of a square (13 November).
- A scrolling vertical seam bar in the overcast deck and the fog banks (26 October).
- svelte-check errors and the `baseUrl` deprecation (9 November).

## [0.12.1] - 2026-10-23

### Fixed

- Upgraded vite, vitest and the Svelte tooling to clear every `npm audit` finding.

## [0.12.0] - 2026-10-15

### Added

- Weather effects flow behind the glass cards, the high/low temperatures are larger, and bank
  holidays are marked (9 October).

### Fixed

- The sky and the hourly strip stay on the current hour, and the forecast refreshes reliably.

## [0.11.0] - 2026-10-07

### Changed

- The text calm zones are gone everywhere: near weather effects now cross in front of the text.
- The temperature curve in the timeline fades to transparent; refreshed SEO and install screenshots.
- Lighter glass, a close button attached to the card, and live city search (6 October).

### Fixed

- A text-shaped hole in the sun's glare (6 October).
- Shadow-only hero contrast, a bigger temperature range and SEO copy (5 October).
- The CI build (vite-plugin-pwa upgrade) and the CI Node version (18 to 22) (5 October).

## [0.10.0] - 2026-10-02

### Added

- City name, air quality, rest-of-day low/high, a bigger date and an Aurora sky mood.

### Fixed

- The date meta and the weather lines are never hidden, on any screen size.
- Text stays readable when the sun or fog is behind it.

## [0.9.0] - 2026-09-30

### Added

- Moon-phase info popover, a scrollable multi-day timeline and holiday/saint provenance
  (29 September).
- Five more languages, for 15 in total, and a warmer logo for bright skies (29 September).
- The ceiling of the UV index and wind-force scales is shown next to the reading.

### Fixed

- Solid popover background for legibility, and the status dot pinned to the true bottom-right corner.

## [0.8.0] - 2026-09-28

### Added

- Brighter, wider weather effects, a real sun/moon arc across the sky, real lightning flashes.
- Optional fullscreen on launch and a go-fullscreen button.

### Changed

- The dashed midnight marker is gone from the timeline; the first column shows the actual hour
  instead of "Now".

### Fixed

- The service worker no longer replays the first forecast forever.
- A weather freeze bug, fullscreen onboarding and the status pill.

## [0.7.0] - 2026-09-25

### Added

- **Weather Dash** branding: logo, SEO tags and install assets.
- Russian, Chinese and Hindi, with a language picker.
- The weather card fits on short screens.

### Fixed

- Natural condition phrases, French saints and regional holidays.
- The photo dim slider is the photo's only dim layer.
- Sunny sky mood, a round sun, a network location fallback, a centered gear button, and a GPS
  timeout.

## [0.6.0] - 2026-09-25

### Added

- Settings backup and restore, debug URL parameters (`?freeze=1`, `?now=`, `?weather=`) and a
  Playwright visual test matrix.

## [0.5.0] - 2026-09-25

### Added

- Weather effects around the screen border (rain, snow, fog, clouds, sun, storm, stars), night mode,
  pixel shift and an anti-burn-in scene.

## [0.4.0] - 2026-09-25

### Added

- Photo backgrounds: import, local storage, rotation and a Ken Burns effect. Settings schema v2
  adds photo dim, blur and shuffle.

## [0.3.0] - 2026-09-24

### Added

- Public holidays and the saint of the day.

## [0.2.0] - 2026-09-24

### Added

- Weather from Open-Meteo, the weather UI and location search.

## [0.1.0] - 2026-09-24

### Added

- Svelte 5, TypeScript and Vite PWA scaffold: layout, clock, settings, toasts and the status pill.

[Unreleased]: https://github.com/LightSeek3r/weather-dash/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/LightSeek3r/weather-dash/compare/v0.13.0...v1.0.0
[0.13.0]: https://github.com/LightSeek3r/weather-dash/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/LightSeek3r/weather-dash/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/LightSeek3r/weather-dash/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/LightSeek3r/weather-dash/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/LightSeek3r/weather-dash/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/LightSeek3r/weather-dash/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/LightSeek3r/weather-dash/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/LightSeek3r/weather-dash/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/LightSeek3r/weather-dash/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/LightSeek3r/weather-dash/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/LightSeek3r/weather-dash/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/LightSeek3r/weather-dash/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/LightSeek3r/weather-dash/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/LightSeek3r/weather-dash/releases/tag/v0.1.0
