# Wall Dashboard

Fullscreen 24/7 weather and date wall display for phones, tablets, and TVs. Local-first settings, beautiful dark visuals with weather-driven effects, and anti-burn-in. Built with Svelte 5, TypeScript, Vite, and PWA technology.

**Features:**

- Responsive fullscreen layout (phone, tablet, desktop, TV)
- Real-time weather from Open-Meteo with dynamic background FX
- Local date/time with holidays and saints
- Local photos with intelligent rotation and Ken Burns effect
- Settings persisted to IndexedDB
- Offline-capable Progressive Web App
- Accessibility first (WCAG AA, reduced motion support)

## Getting Started

```bash
npm install
npm run dev       # Start dev server on http://localhost:5173
npm run build     # Production build
npm run preview   # Preview production build
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run unit tests (Vitest)
- `npm run test:e2e` - Run end-to-end tests (Playwright)
- `npm run lint` - Lint code (ESLint)
- `npm run format` - Format code (Prettier)

## Tech Stack

- **Framework:** Svelte 5 + Vite
- **Language:** TypeScript
- **Testing:** Vitest (unit), Playwright (E2E)
- **Linting:** ESLint + Prettier
- **PWA:** vite-plugin-pwa
- **Data:** valibot, idb-keyval, date-holidays
- **Weather:** Open-Meteo API

## License

MIT
