# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Report it privately in either way:

- GitHub: the **Security** tab of this repository, then **Report a vulnerability**
  (private vulnerability reporting).
- Email: [n.opal@unit42.fr](mailto:n.opal@unit42.fr?subject=Weather%20Dash%20security%20report), the
  address behind the app's own "Report an issue" link.

Include what you found, how to reproduce it, and which page or endpoint is affected. I will
acknowledge a report within a few days and tell you what I plan to do about it. This is a
one-person project, so these are best-effort timelines, not guarantees.

## Scope

In scope: the web app, its service worker and web manifest, the `/api/geo` Pages Function
(`functions/api/geo.ts`), the build scripts and the GitHub workflows.

Out of scope: the third-party services the app talks to (Open-Meteo, OpenStreetMap Nominatim) and
the platforms it runs on (Cloudflare, GitHub). Please report those to their owners.

## Supported versions

Only the latest release and the current `main` branch are supported.

## What the repository contains

No secrets: the app has no backend credentials, no accounts and no API keys. Weather and place
data come from keyless public APIs, and the user's settings and photos never leave their device.
If you ever find a credential in this repository or its history, that is a vulnerability: please
report it as above.
