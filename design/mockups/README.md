# Wall dashboard: three aesthetic directions

Three standalone HTML mockups of the 24/7 ambient wall display. Each file has inline CSS/JS and no build step, and makes zero network requests. Fonts are OFL Google Fonts latin subsets, inlined as base64 woff2. Open any file directly in a browser. Append `?photo=1` to simulate the worst case for photo rotation: a bright, busy white stand-in fills the `data-bg-slot="photo"` layer and the scrim switches to full strength. Every file follows the same rules:

- **Units and orientation.** Everything is sized from one fluid unit, `--u = min(1vw, 1.55vh)`. It swaps to a portrait value on tablets, so both 1920x1080 landscape and portrait fill the screen with no scrolling. Phone portrait is not specifically tuned.
- **Burn-in.** The whole page drifts ±3 px every few minutes against burn-in.
- **Settings gear.** It rests at low opacity and wakes on touch or pointer. The touch target is 48 px.
- **Motion.** Decorative motion stops under `prefers-reduced-motion`.
- **Background.** It is never pure `#000`, to avoid OLED black smear. It stays mostly dark, for panel power and to avoid lighting the room at night.
- **Scrim.** Its alpha is computed for a pure-white photo, blended the way browsers actually blend (gamma-encoded sRGB), so every text color keeps at least 4.5:1 (WCAG AA) over any image.
- **Weather FX.** Each mockup demonstrates one weather-state border effect (sun glare, rain on glass, snow). The FX layer is self-contained (`data-fx`), so any direction can swap in the others.

## 01 · Almanac (`01-almanac.html`)

An editorial broadsheet printed in two inks on warm black. It is the dashboard as the front page of a daily almanac. Display type is **Bodoni Moda**, a high-contrast Didone with optical sizing. The clock is roman with a vermilion colon, and the day name and saint are in italic. Labels and small caps are set in **Jost**, a geometric sans that stays open at small sizes.

The palette has only two inks on `#12100d` warm paper-black. Cream ink `#f1e8d8` is stepped down to `#cdbfa8` and `#a89a84` for hierarchy. Vermilion `#ff6a45` is reserved for "now": the colon, the elapsed-daylight arc and the midnight marker. Structure comes from newspaper double rules and column rules, not boxes, so there are no cards at all.

- The current conditions have an engraved, hatched sun.
- The 24 h timeline is a printed chart: a hairline temperature curve over hatched rain bars.
- Tomorrow is a single byline sentence.
- FX: a slow sun glare / light leak in the top-right corner, plus faint paper grain.

Why it fits a wall:

- A Didone clock roughly a sixth of the screen wide is very legible at 3 m because its thick strokes carry the shape.
- The two-ink palette keeps it calm enough to live with all day.
- It reads as a printed object rather than an app.

## 02 · Blue Hour (`02-blue-hour.html`)

A soft atmospheric view through a rain-beaded window at dusk. The type pairing puts **Lexend** in its thin weights (200–250) on the clock and temperature. Lexend was designed for reading ease, and its wide apertures survive thin weights at distance. **Atkinson Hyperlegible**, the Braille Institute face built so that confusable glyphs like 1/l/I and 0/O differ, carries the labels and data.

The color system is a deep blue-hour gradient (`#0a1726` → `#1a2e46`) with slowly drifting light pools. Text is cool white `#eef4fb` in three steps. Peach `#ffb896` marks warmth, the sun and "now", and ice/rain blues `#a6dcff` / `#7cc4ff` mark precipitation.

There are exactly two frosted-glass panes: a current-conditions capsule and the timeline band. They are deliberately not a card grid.

- The capsule adds a 60-minute nowcast sparkline and a compass-dial wind readout.
- FX: 110 static droplets and 7 running drops with trails, masked to the screen edges so the centre stays clean.

Why it fits a wall:

- It is the most "ambient" of the three: low contrast between surfaces but high contrast for text.
- Motion is limited to slow drift, so it disappears into a room at night.
- The glass works naturally over a rotating family photo.

## 03 · Instrument (`03-instrument.html`)

A retro-futuristic console, like a 1970s flight-deck or VFD instrument panel, shown in an alpine snow state (Zermatt). The clock and temperature are true **seven-segment readouts drawn as SVG**. Unlit segments stay faintly visible as ghost segments, the way real VFD glass does, with a phosphor glow on the lit ones. Readouts and labels use **Barlow Condensed**, which comes from California highway signage and was built to be read at distance and speed. Engraved micro-labels use **JetBrains Mono**.

The color system is one phosphor on graphite:

- Base `#0d0f0d`.
- Amber `#ffb43d` for lit values, dimmed `#d4a45c` for secondary values.
- Khaki `#aaa38d` for engraved labels.
- Ice `#9fe3ee` as the second channel, for cold and precipitation.
- Red-orange `#ff7a55` only for gusts and warnings.

Layout is four numbered, hairline-framed modules with corner registration ticks (Chrono, Ext, Trend, T+1). There is no rounded card chrome.

- Segmented LED bar gauges show feels-like, humidity and UV.
- A compass rose sits with a 13-step Beaufort bar.
- A day-length track shows the current time.
- The 24 h timeline is a strip-chart recorder with a glowing trace, a dashed 0 °C line and LED-column precipitation.
- The settings gear is a machined knob.
- FX: a snowdrift banked along the bottom edge, frost in the corners, and sparse falling flakes masked to the margins.

Why it fits a wall:

- Seven-segment digits are the most distance-legible numerals there are.
- Amber on graphite has very low light output at night.
- The ghost segments keep a fixed silhouette, so numbers never jump.
- The strong, specific concept is as far from generic dashboard styling as possible.

## Placeholder data

Thursday 24 September 2026, ISO week 39, day 267/365, Ste Thècle (French civil calendar), and Heritage Day (ZA) as an extra-country holiday example. Brussels (01, 02; sunrise 07:34, sunset 19:38) and Zermatt (03; 07:24 / 19:27). Weather values are illustrative.
