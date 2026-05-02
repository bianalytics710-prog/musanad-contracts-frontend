# Musanad Contracts — Frontend

TanStack Start + React 19 + Tailwind 4 frontend for the Musanad Contracts Hub.
Generated from the v2.6 Lovable Modernization pipeline (M0 Foundation).

## Stack

- **Framework:** TanStack Start (file-based routing under `src/routes/`)
- **React:** 19.2
- **Language:** TypeScript strict
- **Styling:** Tailwind 4 (CSS-first, `@theme inline` in `src/styles.css`)
- **State:** Zustand (auth) + React Query (server state)
- **HTTP:** Axios with JWT interceptor + silent refresh-token rotation
- **Validation:** Zod + react-hook-form
- **i18n:** react-i18next (English + Arabic, with RTL support)
- **Animation:** Framer Motion
- **SSR runtime:** Cloudflare Workers (deferred; see `wrangler.jsonc`)
- **Tests:** Vitest + Testing Library + jsdom

## Prerequisites

- Node.js 20+
- The Musanad backend running on `http://localhost:4000`
  (see `musanad-contracts-backend/`).

## Quick start

```bash
cp .env.example .env.local           # adjust VITE_API_BASE_URL if needed
npm install
npm run dev                          # http://localhost:5173
```

The default admin user (created by the backend M0 migration) is:

```
email:    admin@musanad.local
password: ChangeMe@123
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the TanStack Start dev server on port 5173 |
| `npm run build` | Production build |
| `npm run start` | Start the production server (after `build`) |
| `npm run typecheck` | `tsc --noEmit` with `--max-old-space-size=512` |
| `npm test` | Run Vitest in CI mode |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |

## Environment variables

| Var | Purpose | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:4000` |
| `VITE_DISPLAY_TIMEZONE` | Timezone used by `formatDateTime` | `Asia/Dubai` |
| `VITE_DEFAULT_LOCALE` | Initial UI locale | `en` |

`.env.local` is gitignored. Never commit secrets.

## Architecture notes

- **Tokens are CSS-first.** All design tokens live in `src/styles.css` via Tailwind 4
  `@theme inline`. The TypeScript map in `src/lib/design-system/tokens.ts` mirrors them
  for cases where JS needs the value. **Do not edit `src/styles.css` ad-hoc** — it is
  locked by the Design System Agent.
- **Auth tokens.** Stored via Zustand persist under `musanad_auth` in localStorage.
  Refresh-token rotation: every successful `/auth/refresh` returns a new pair; we
  overwrite both. The old refresh token is invalid afterwards (per OWASP / RFC 6749).
- **No `lovable.app` URLs.** Audit Pass 10 flagged a stale Lovable preview URL in the
  Lovable repo's `__root.tsx`; this regenerated repo has none.
- **i18n.** EN/AR with RTL via `<html dir="rtl" lang="ar">`. The `ThemeProvider`
  manages dark mode and locale; i18next is initialised in `src/i18n/index.ts`.

## Module roadmap

This repo currently contains M0 — Foundation only. Feature modules (M1+) will land
under `src/features/<module>/` and register routes under `src/routes/_app/<module>/`.
