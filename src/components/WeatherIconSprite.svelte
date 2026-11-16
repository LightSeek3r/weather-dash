<!--
  Weather condition icon sprite — hand-authored 32-unit-grid soft-filled
  style lifted from design/mockups/02-blue-hour.html (the chosen aesthetic),
  extended with i-snow/i-fog/i-storm for phase 2. Mount this component
  exactly ONCE for the whole app (it's mounted inside CurrentWeather.svelte,
  since that's guaranteed present whenever the weather feature is active) —
  every other weather component references these ids via a plain
  `<svg class="ic"><use href="#i-x"/></svg>`, which resolves against
  whichever copy of this sprite is in the DOM. Mounting it more than once
  would create duplicate `id` attributes.
-->

<!-- No logic: this empty script is what lets svelte-check give the file a
     module declaration, so `import WeatherIconSprite` type-checks. -->
<script lang="ts"></script>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <linearGradient id="g-cloud" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f1f6fc" />
      <stop offset="1" stop-color="#a9bbcf" />
    </linearGradient>
    <linearGradient id="g-cloud-dark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8397ad" />
      <stop offset="1" stop-color="#55687e" />
    </linearGradient>
    <radialGradient id="g-sun" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#ffe3c8" />
      <stop offset="0.6" stop-color="#ffb896" />
      <stop offset="1" stop-color="#ff9a7a" />
    </radialGradient>
    <linearGradient id="g-moon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4f1e6" />
      <stop offset="1" stop-color="#c9d3df" />
    </linearGradient>

    <!-- soft filled icons, 32-unit grid (from the mockup) -->
    <symbol id="i-cloud" viewBox="0 0 32 32">
      <path
        d="M10 24H23A5 5 0 0 0 23 14A7 7 0 0 0 10.5 16.2A4 4 0 0 0 10 24Z"
        fill="url(#g-cloud)"
      />
    </symbol>
    <symbol id="i-cloud-dark" viewBox="0 0 32 32">
      <path
        d="M10 24H23A5 5 0 0 0 23 14A7 7 0 0 0 10.5 16.2A4 4 0 0 0 10 24Z"
        fill="url(#g-cloud-dark)"
      />
    </symbol>
    <symbol id="i-sun" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="7" fill="url(#g-sun)" />
    </symbol>
    <symbol id="i-moon" viewBox="0 0 32 32">
      <path
        d="M19 6.5A10 10 0 1 0 26.5 21A8 8 0 0 1 19 6.5Z"
        fill="url(#g-moon)"
      />
    </symbol>
    <symbol id="i-rain" viewBox="0 0 32 32">
      <use href="#i-cloud-dark" x="4" y="-6" width="28" height="28" />
      <use href="#i-cloud" y="-4" width="32" height="32" />
      <g stroke="#7cc4ff" stroke-width="2" stroke-linecap="round">
        <path d="M12 24l-1 3.5M17 24l-1 3.5M22 24l-1 3.5" />
      </g>
    </symbol>
    <symbol id="i-cloudy" viewBox="0 0 32 32">
      <use href="#i-cloud-dark" x="5" y="-4" width="27" height="27" />
      <use href="#i-cloud" x="-1" y="1" width="31" height="31" />
    </symbol>
    <symbol id="i-partly" viewBox="0 0 32 32">
      <use href="#i-sun" x="-5" y="-6" width="28" height="28" />
      <use href="#i-cloud" x="2" y="2" width="30" height="30" />
    </symbol>
    <symbol id="i-moon-cloud" viewBox="0 0 32 32">
      <use href="#i-moon" x="-4" y="-5" width="26" height="26" />
      <use href="#i-cloud" x="3" y="3" width="29" height="29" />
    </symbol>

    <!-- phase 2 additions: same grid + gradient approach as above -->
    <symbol id="i-snow" viewBox="0 0 32 32">
      <use href="#i-cloud-dark" x="4" y="-6" width="28" height="28" />
      <use href="#i-cloud" y="-4" width="32" height="32" />
      <g fill="#eef4fb">
        <circle cx="12" cy="25.5" r="1.6" />
        <circle cx="17" cy="27" r="1.6" />
        <circle cx="22" cy="25.5" r="1.6" />
      </g>
    </symbol>
    <symbol id="i-fog" viewBox="0 0 32 32">
      <g
        fill="none"
        stroke="#95a9bd"
        stroke-width="2"
        stroke-linecap="round"
        opacity="0.85"
      >
        <path d="M6 13c3-2 6 2 9 0s6-2 9 0" />
        <path d="M4 18c3-2 6 2 9 0s6-2 9 0" />
        <path d="M8 23c3-2 6 2 8 0" />
      </g>
    </symbol>
    <symbol id="i-storm" viewBox="0 0 32 32">
      <use href="#i-cloud-dark" x="4" y="-6" width="28" height="28" />
      <use href="#i-cloud-dark" y="-4" width="32" height="32" opacity="0.9" />
      <path d="M17 15l-5 8h4l-2 6 7-9h-4z" fill="#ffb896" />
    </symbol>

    <!-- outline twins of the condition icons (`<id>-line`): same 32-unit grid,
         stroke only, for the current-conditions tile. Where one shape sits in
         front of another, a mask knocks the back shape's line out around it
         so the outlines never cross. -->
    <path
      id="p-cloud"
      d="M10 24H23A5 5 0 0 0 23 14A7 7 0 0 0 10.5 16.2A4 4 0 0 0 10 24Z"
    />
    <mask
      id="m-cloudy-back"
      maskUnits="userSpaceOnUse"
      x="-4"
      y="-4"
      width="40"
      height="40"
    >
      <rect x="-4" y="-4" width="40" height="40" fill="#fff" />
      <use
        href="#p-cloud"
        transform="translate(-1 3)"
        fill="#000"
        stroke="#000"
        stroke-width="4"
        stroke-linejoin="round"
      />
    </mask>
    <mask
      id="m-cloud-corner"
      maskUnits="userSpaceOnUse"
      x="-4"
      y="-4"
      width="40"
      height="40"
    >
      <rect x="-4" y="-4" width="40" height="40" fill="#fff" />
      <use
        href="#p-cloud"
        transform="translate(3 4)"
        fill="#000"
        stroke="#000"
        stroke-width="4"
        stroke-linejoin="round"
      />
    </mask>

    <symbol id="i-sun-line" viewBox="0 0 32 32">
      <g
        fill="none"
        stroke="#ffb896"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="16" cy="16" r="6" />
        <path
          d="M25.5 16H28.5M22.72 22.72L24.84 24.84M16 25.5V28.5M9.28 22.72L7.16 24.84M6.5 16H3.5M9.28 9.28L7.16 7.16M16 6.5V3.5M22.72 9.28L24.84 7.16"
        />
      </g>
    </symbol>
    <symbol id="i-moon-line" viewBox="0 0 32 32">
      <path
        d="M19 6.5A10 10 0 1 0 26.5 21A8 8 0 0 1 19 6.5Z"
        fill="none"
        stroke="#e9e6d8"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </symbol>
    <symbol id="i-cloudy-line" viewBox="0 0 32 32">
      <g
        fill="none"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <g mask="url(#m-cloudy-back)">
          <use href="#p-cloud" transform="translate(2 -3)" stroke="#8fa5bd" />
        </g>
        <use href="#p-cloud" transform="translate(-1 3)" stroke="#e4edf8" />
      </g>
    </symbol>
    <symbol id="i-partly-line" viewBox="0 0 32 32">
      <g
        fill="none"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <g mask="url(#m-cloud-corner)" stroke="#ffb896">
          <circle cx="13" cy="13" r="5.5" />
          <path
            d="M21 13H23.5M18.66 18.66L20.42 20.42M13 21V23.5M7.34 18.66L5.58 20.42M5 13H2.5M7.34 7.34L5.58 5.58M13 5V2.5M18.66 7.34L20.42 5.58"
          />
        </g>
        <use href="#p-cloud" transform="translate(3 4)" stroke="#e4edf8" />
      </g>
    </symbol>
    <symbol id="i-moon-cloud-line" viewBox="0 0 32 32">
      <g
        fill="none"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <g mask="url(#m-cloud-corner)">
          <path
            transform="translate(-3 -2) scale(0.72)"
            d="M19 6.5A10 10 0 1 0 26.5 21A8 8 0 0 1 19 6.5Z"
            stroke="#e9e6d8"
            stroke-width="2"
          />
        </g>
        <use href="#p-cloud" transform="translate(3 4)" stroke="#e4edf8" />
      </g>
    </symbol>
    <symbol id="i-rain-line" viewBox="0 0 32 32">
      <g
        fill="none"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <use href="#p-cloud" transform="translate(0 -3)" stroke="#e4edf8" />
        <path d="M12 24l-1.5 4M17 24l-1.5 4M22 24l-1.5 4" stroke="#7cc4ff" />
      </g>
    </symbol>
    <symbol id="i-snow-line" viewBox="0 0 32 32">
      <g
        fill="none"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <use href="#p-cloud" transform="translate(0 -3)" stroke="#e4edf8" />
        <g stroke="#eef4fb">
          <circle cx="12" cy="25" r="1.4" />
          <circle cx="17" cy="27.5" r="1.4" />
          <circle cx="22" cy="25" r="1.4" />
        </g>
      </g>
    </symbol>
    <symbol id="i-storm-line" viewBox="0 0 32 32">
      <g
        fill="none"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <use href="#p-cloud" transform="translate(0 -4)" stroke="#a9bbd2" />
        <path d="M17.5 20.5l-5 6h4l-2 4.5 7-7.5h-4z" stroke="#ffb896" />
      </g>
    </symbol>
    <symbol id="i-fog-line" viewBox="0 0 32 32">
      <g
        fill="none"
        stroke="#95a9bd"
        stroke-width="1.5"
        stroke-linecap="round"
        opacity="0.9"
      >
        <path d="M6 13c3-2 6 2 9 0s6-2 9 0" />
        <path d="M4 18c3-2 6 2 9 0s6-2 9 0" />
        <path d="M8 23c3-2 6 2 8 0" />
      </g>
    </symbol>

    <!-- reused non-condition glyphs from the mockup -->
    <symbol id="i-rise" viewBox="0 0 24 24">
      <g
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path d="M3 19h18M7 19a5 5 0 0 1 10 0M12 4v6M9 7l3-3 3 3" />
      </g>
    </symbol>
    <symbol id="i-set" viewBox="0 0 24 24">
      <g
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path d="M3 19h18M7 19a5 5 0 0 1 10 0M12 4v6M9 7l3 3 3-3" />
      </g>
    </symbol>
    <symbol id="i-drop" viewBox="0 0 24 24">
      <path
        d="M12 3.5c3.2 4.2 5.5 7.3 5.5 10.2a5.5 5.5 0 0 1-11 0c0-2.9 2.3-6 5.5-10.2z"
        fill="currentColor"
      />
    </symbol>
    <symbol id="i-arrow" viewBox="0 0 24 24">
      <path d="M12 3l5 14-5-3-5 3z" fill="currentColor" />
    </symbol>
    <symbol id="i-info" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="9" />
        <path stroke-linecap="round" d="M12 11v5" />
        <circle cx="12" cy="7.5" r="0.1" stroke-linecap="round" />
      </g>
    </symbol>
    <symbol id="i-air" viewBox="0 0 24 24">
      <g
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path d="M3 8h11a3 3 0 1 0-3-3" />
        <path d="M3 12h16a3 3 0 1 1-3 3" />
        <path d="M3 16h7" />
      </g>
    </symbol>
    <symbol id="i-pin" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="2">
        <path
          stroke-linejoin="round"
          d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"
        />
        <circle cx="12" cy="10" r="2.3" />
      </g>
    </symbol>
    <symbol id="i-bank-holiday" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="2">
        <rect x="4" y="5" width="16" height="15" rx="2.5" />
        <path stroke-linecap="round" d="M4 10h16M8 3v4M16 3v4" />
      </g>
      <path
        fill="currentColor"
        d="m12 12.2.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1L9 14.4l2.1-.3z"
      />
    </symbol>
  </defs>
</svg>
