# מערכת שעות — WEBTOP‑inspired iPhone PWA (unofficial)

> **Unofficial personal project.** This app is *inspired by* the WEBTOP timetable screen. It is
> **not affiliated with, endorsed by, or connected to WEBTOP**, its vendor, the Ministry of
> Education or any school. It never asks for WEBTOP credentials, never calls WEBTOP endpoints
> and stores everything locally on the device.

An iPhone-first Progressive Web App that reproduces the look of the WEBTOP "מ. שעות ושינויים"
screen closely (dark theme, RTL, measured against frames of a reference screen recording). The
timetable, notices and exams are **edited locally** in a hidden edit mode.

| Timetable | Sidebar | Lesson editor (edit mode) |
|---|---|---|
| ![timetable](docs/screenshots/timetable.png) | ![sidebar](docs/screenshots/sidebar.png) | ![editor](docs/screenshots/lesson-editor.png) |

*(Screenshots show the built-in **fictional example data**.)*

## Features

- **Timetable** for Sunday–Thursday with up to 13 periods (bell times taken from the reference).
  Includes a day selector, swipe navigation that never fights vertical scrolling, and a
  scroll-to-top button. Empty periods are real rows.
- **שינויים והודעות** and **אירועים ומבחנים** tabs backed by local data. The events tab has a
  month view, a kind filter, a group filter and `.ics` export.
- **ריכוז מידע** home screen: Hebrew date, greeting, editable shortcuts, today's lessons.
- **Sidebar** mirroring the reference menu. Entries with no local equivalent open clearly
  labelled placeholders.
- **Hidden local edit mode**. In it you can:
  - add, edit, duplicate, move, copy and delete lessons, or set a period empty;
  - fill subject, teacher, room and colour from a subject preset in one tap, with per-lesson
    overrides that never change the preset;
  - manage presets and choose whether to apply a changed preset to all its lessons (explicit
    confirmation required);
  - add, edit and delete notices, exams and events, and edit the display/class name;
  - export and import validated JSON, and reset any area after confirmation;
  - undo destructive edits from the confirmation toast.
- **PWA**: standalone display, safe-area aware, Apple touch icon and launch images, offline
  after the first load, and a versioned service worker with an update banner.

## Requirements

- Node.js 20.19+ (CI uses Node 22)
- iPhone / iPad: iOS 15.4 or later (native `<dialog>`, `dvh` units)

## Getting started

```bash
npm ci
npm run dev          # http://localhost:5173/WEBTOP/
npm run check        # typecheck + lint + unit tests + production build
npm run test:e2e     # Playwright (builds must exist: run `npm run build` first)
npm run preview      # serve dist/ at http://localhost:4173/WEBTOP/
```

The service worker is registered only in production builds (`build` + `preview`), never by the
dev server.

| Script | Purpose |
|---|---|
| `typecheck` | `tsc -b` in strict mode across app, service worker, tooling and e2e projects |
| `lint` | ESLint (typescript-eslint strict and React Hooks / React Compiler rules) |
| `test` | Vitest unit tests for domain rules, storage, validation and backups |
| `test:e2e` | Playwright on an iPhone-sized Chromium against the production build under `/WEBTOP/` |
| `icons` | Regenerates the app icons and iOS launch images (`scripts/generate-icons.mjs`) |

## Using it on an iPhone

1. Open **https://omriweb10.github.io/WEBTOP/** in Safari (once GitHub Pages is enabled; see below).
2. Tap **Share → Add to Home Screen**, then launch it from the Home Screen icon.
3. Load your own data in the installed app (step 4 explains why): enter edit mode, then
   **כלים → ייבוא מקובץ JSON…**, and pick your private backup file.
4. A Home Screen web app on iOS has **separate storage from Safari**. Data imported in a Safari
   tab does not appear in the installed app, and the reverse.

### Hidden edit mode

Tap the title **"מ. שעות ושינויים" seven times quickly**, then enter the demonstration code
**`581026`**. A yellow strip shows that you are editing the **personal local copy**. Use
**יציאה** to leave; a cold start always opens in viewing mode.

> The code is a UI convenience that keeps edit controls out of the way. It is **not**
> authentication, it is visible in the source, and it protects nothing. It does not grant any
> access to the official WEBTOP system.

To edit a lesson, tap it (or an empty "+ הוספת שיעור" cell) while edit mode is on. The **כלים**
screen holds presets, the profile/class name, backup and import, and resets.

### Where your data lives (read this)

- Everything is stored in the browser's **localStorage** for this origin, with a versioned and
  validated envelope per data area.
- **Clearing Safari website data, deleting the Home Screen app, or moving to a different URL
  (origin) can erase your edits.** Export a JSON backup now and then. The app also asks the
  browser for persistent storage.
- If stored data is ever unreadable, it is **kept** under a `*.corrupt.<timestamp>` key, the app
  falls back to defaults, and you see a message. Data is never discarded silently.

## Private data (real timetable)

This repository is **public**, so it contains **no real names, rooms, school name or personal
timetable**. The built-in data is a fictional example: teachers are "מורה ל…", rooms are
101–112, and the class name is "(דוגמה)". Subject names, bell times and colours are generic and
committed.

Keep your real data in a backup JSON that is **never committed**:

- `private/` and `*.private.json` are gitignored.
- `npm test` validates any `private/*.private.json` it finds, so a broken file is caught before
  you import it.

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` runs **typecheck → lint → unit tests → build → Playwright e2e**
on every pull request and on pushes to `main`. On `main` it then deploys `dist/` to GitHub Pages.

One-time setup (repository owner):

1. **Settings → Pages → Build and deployment → Source: _GitHub Actions_.**
2. Merge the PR into `main`; or, once the workflow is on `main`, run it manually from the
   **Actions** tab (*Run workflow* on `main`).
3. The site is published at `https://omriweb10.github.io/WEBTOP/`.

The Vite `base`, manifest `scope`/`start_url` and service-worker scope all resolve to
`/WEBTOP/`. Builds use `BASE_PATH` (the workflow sets it to `/<repository name>/`; locally it
defaults to `/WEBTOP/`). For a custom domain at the root, build with `BASE_PATH=/`. Routing uses
the URL hash (`#/schedule/events`), so deep links work on Pages without server rewrites.

## Offline & updates

- At build time a small Vite plugin (`build/serviceWorkerPlugin.ts`) compiles
  `src/sw/service-worker.ts`. It injects the list of emitted files and a **content hash**
  version, which becomes the cache name.
- **Navigations** are network-first with a 3 s timeout, falling back to the cached shell
  offline. **Assets** are cache-first: they are hashed and immutable.
- Activation **deletes caches of older versions**.
- `sw.js` is fetched with `updateViaCache: 'none'`. Updates are checked at launch, when the app
  returns to the foreground, and every 30 minutes.
- A new version found while you use the app shows **"גרסה חדשה… רענון"**. If a new version is
  already waiting when the app starts, it is activated immediately with a single reload, so
  nobody stays on an old version.
- iOS launch images are excluded from the precache; the OS fetches them at install time.

## Architecture

React 19 + TypeScript (strict) + Vite 7, with zustand for state and zod for validation. There is
no backend, no router library and no icon package at runtime.

```
src/
├── app/                 App shell, hash router, route→screen mapping, sidebar menu config
│   └── screens/         Composition screens (ScheduleHubScreen: the three tabs)
├── components/
│   ├── layout/          Header, NavigationTabs, Sidebar (+header), ScreenFrame
│   └── ui/              Button, IconButton, Icon (+generated Material Symbols paths), Modal,
│                        ConfirmHost/confirm(), fields, ColorPicker, SectionCard, ItemRow, Toasts…
├── features/
│   ├── timetable/       components/ (TimetableTab, TimetableTable, LessonCard, EmptyPeriod,
│   │                    DaySelector, LessonEditor, MoveCopyPanel, export sheet, print layout),
│   │                    hooks/ (swipe, scroll), domain/ (pure: ops, days, periods, drafts, ICS),
│   │                    timetableActions (undoable use-cases), view store
│   ├── presets/         Preset picker/manager/form + pure preset↔lesson rules + actions
│   ├── admin/           7-tap detector, demo-code check, edit-mode store, admin screen,
│   │                    import/export & reset use-cases
│   ├── notices/ events/ Tabs, editors, pure sort/filter/group rules, actions
│   ├── home/ settings/ placeholders/
├── schemas/             zod schemas: the single source of truth for persisted & imported data
├── services/
│   ├── storage/         KeyValueStore abstraction, versioned envelopes, migrations, quarantine
│   ├── backup/          Backup file creation/parsing (all-or-nothing validation)
│   ├── calendar/        RFC 5545 writer
│   ├── files/           Share-sheet / download / file reading
│   ├── pwa/             Service-worker registration & update manager
│   └── session/         Local launch tracking
├── store/               Persisted zustand stores (one per data slice) + UI store
├── sw/                  Service worker (separate tsconfig with WebWorker lib)
├── styles/              tokens.css (all colours/sizes/typography), tokens.ts, fonts, globals
├── data/                Default periods, presets, fictional example timetable
└── utils/               Dates, Hebrew calendar numerals, time, colour mixing, ids
tests/unit/              Vitest
tests/e2e/               Playwright
docs/visual-spec.md      UI inventory, measurements, colours, deviations
```

Design rules followed:

- Business rules are **pure functions** (`features/*/domain`) with unit tests. Components call
  use-case modules (`*Actions.ts`) and never contain timetable rules.
- Persistence sits behind the storage service. Every value is validated **on load, on save and
  on import**.
- Display tokens are centralised in `src/styles/tokens.css` (and the few needed in TS in
  `tokens.ts`).

### Backup file format

```json
{
  "format": "webtop-pwa-backup",
  "formatVersion": 1,
  "exportedAt": "2026-10-19T08:00:00.000Z",
  "appVersion": "1.0.0",
  "data": {
    "timetable": { "periods": [{ "number": 1, "start": "8:00", "end": "8:50" }],
                   "days": { "sun": [null], "mon": [], "tue": [], "wed": [], "thu": [] } },
    "presets": [{ "id": "preset_math", "name": "מתמטיקה", "subject": "…", "teacher": "", "room": "", "color": "#1498fd" }],
    "profile": { "studentName": "", "subtitle": "", "className": "י' 1" },
    "notices": [], "events": [], "settings": { "…": "…" }
  }
}
```

Every part of `data` is optional, so presets can be exported and restored on their own. Each
day must have exactly one cell per period: a lesson object or `null` for an empty period.

## Testing status

- Unit tests (Vitest): timetable operations, preset propagation and overrides, storage
  versioning/migration/quarantine, backup validation, ICS, Hebrew dates, the tap gesture.
- E2E (Playwright, Chromium with iPhone viewport and touch): day/tab/sidebar navigation, real
  touch swipes vs vertical scroll, the FAB, edit-mode unlock and exit, preset fill, overrides,
  empty↔lesson, duplicate/move/delete/undo, preset propagation with confirmation, resets,
  JSON export/import (valid and invalid), notices/exams persistence, change alerts, corrupted
  storage handling, manifest/icons, offline reload, cleanup of old caches, and a clean console.
- Visual: screenshots at the reference geometry were compared frame-by-frame with the
  recording. See `docs/visual-spec.md`.

Not covered automatically: real iOS Safari/WebKit (CI uses Chromium), "Add to Home Screen"
itself, and iOS launch images. Check those on a device.

## Third-party notices

- **Open Sans**: SIL Open Font License 1.1 (via `@fontsource/open-sans`).
- **Material Symbols** path data (`src/components/ui/icons/iconPaths.ts`): © Google, Apache
  License 2.0.
- App icon, launch images and the home-screen illustration are original to this project. No
  WEBTOP assets are used or hot-linked.
