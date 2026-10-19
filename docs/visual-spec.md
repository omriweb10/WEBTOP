# Visual specification & UI inventory

Derived from the supplied 25-second reference screen recording (512×1112 px, 30 fps). Fifty
frames (2 fps) plus scene-change frames were extracted and measured with pixel scans.
**No real names, rooms or schedule from the recording appear in this repository.**

## Device geometry (observed)

| Item | Value | How it was determined |
|---|---|---|
| Logical viewport | **402×874 pt** (iPhone 16 Pro / 17 Pro class) | 512/402 = 1.2736, 874 × 1.2736 = 1113 ≈ 1112 px |
| Scale | 1.2736 video px per CSS px | |
| Top safe area | 62 pt (79 px) | app bar begins at y = 79–80 px |
| Bottom safe area | 34 pt (43 px) | content ends at y = 1069 px |

The status bar, Dynamic Island, recording dot, clock, battery and the home indicator are iOS
system UI and are **not** reproduced. The app paints both safe areas with `#12161c`, which is
the colour the reference shows behind the system UI.

## Screen inventory

| Screen | Seen in recording | Implemented as |
|---|---|---|
| מ. שעות ושינויים → **מערכת שעות** tab | Yes, all 5 days, scrolled and unscrolled | `TimetableTab`: matches the reference geometry to ±1 video px |
| → **שינויים והודעות** tab | Yes (all sections empty) | `ChangesTab`: four sections, local notices/exams/events, same empty-state text |
| → **אירועים ומבחנים** tab | Yes (loading spinner only) | `EventsTab`: group filter plus a list or month view of local items; empty state instead of a spinner |
| Sidebar drawer | Yes | `Sidebar`: same items, order, icons and active styling; adds "הגדרות ואודות" |
| ריכוז מידע (home) | Yes | `HomeScreen`: date bar with Hebrew date, greeting, notices summary, editable shortcuts, changes, today's lessons |
| Other drawer items | Listed only | Clearly labelled placeholder screens; no fake content |
| Edit mode, editors, admin | No (new) | Hidden behind 7 taps on the title plus the demo code |

## Layout measurements (pt)

| Region | Height / size | Notes |
|---|---|---|
| App bar | 55 | bg `#14263c`. Menu icon centred 36 pt from the right edge; title 16 pt bold, white; actions 40 pt apart, first centred 36 pt from the left edge |
| Tabs | 48 + 2 pt divider | Three equal columns, 12 pt labels. Active: `#82b1f2`, bold, 2 pt underline |
| "תצוגה" panel | 64 | Label 10 pt at ~13 pt from top; value 13 pt; 1 pt underline `#353a47` at 55 pt; ▾ arrow at the far left |
| Gap | 8 | page colour `#12161c` |
| Day bar | 58 | bg `#1b1f27`. Five letters spaced with `space-between`; first and last circles touch the 16 pt gutters. Active day: 32 pt circle `#45aba0`, dark letter |
| Table | inset 16 pt | 1 pt grid `#2d323f`, outer border `#272f3f` |
| Table header row | 45 | bg `#252d3c`, 12 pt bold, "שעה/יום" plus day name |
| Period column | 92 wide | 12 pt bold, centred. "8:50-8:00 .1" visual order, reproduced with the bidi-neutral U+2010 hyphen |
| Lesson cell | 4 pt padding | |
| Lesson card | 61 tall (3 lines), 43 (2 lines) | 18 pt line height, centred 12 pt text (subject bold), 4 pt accent on the start (right) edge, 3 pt radius |
| Empty period row | 34 | blank cell. Rows are never removed |
| Space below last row | 72 | clears the FAB |
| Scroll-to-top FAB | 56 | white, bottom-right, 16 pt from the right and bottom edges; appears after scrolling |
| Sidebar | 321 wide | header 111 pt (`#0f2135` + waves), subtitle row 46 pt, items 46 pt, 20 pt icons, active item `#a8caf6` bold plus 4 pt bar |
| Notices sections | header 42, row 47, 16 between | bg `#181e26`, 14 pt bold text |

Residual difference against matching frames, cropped to the app area: mean absolute error is
about 4–6 of 255 per channel, almost entirely text anti-aliasing (iOS CoreText vs Chromium).

## Typography

The reference glyph shapes match **Open Sans** (Hebrew + Latin). It is self-hosted from
`@fontsource/open-sans` (SIL OFL), with weights 400/600/700 and the Hebrew and Latin subsets
only. Sizes were calibrated by matching rendered text widths to measured widths (±0.5 pt).

## Colours

Surfaces and text colours were sampled with 3×3/median pixel sampling (see
`src/styles/themes/dark.css`; the light theme is described at the end of this section).

Subject accents follow the project brief and were cross-checked against the card edges in the
recording. The sampled values differ only by H.264 chroma error. Card backgrounds in the
recording equal the accent mixed into `#191e29` at about **16 %**: every subject measured
15–17 %. The app computes that mix itself (`src/theme/lessonCardColors.ts`) instead of storing a
second colour per subject.

| Subject (preset) | Accent |
|---|---|
| English | `#999a9d` |
| Mathematics | `#1498fd` |
| History | `#444cc1` |
| Hebrew language (לשון) | `#f4490c` |
| Bible (תנ"ך) | `#04b9d4` |
| Sign language | `#e50066` |
| Homeroom (חינוך) | `#ffbe10` |
| Physical education | `#059f8b` |
| Chemistry | `#92be43` |
| Robotics / Biotechnology / Biology | `#259e3b` |
| Traffic education (חינוך תעבורתי) | `#e50066` (observed: same accent as sign language) |

### Light theme (from the original WEBTOP light screenshot)

Sampled from an iPhone screenshot (402×874 pt at 2.29 px/pt). Geometry is identical to the dark
theme (55 pt app bar, 48 pt tabs, 64 pt display panel, 8 pt gap, 58 pt day bar, 16 pt gutters,
92 pt period column, 4 pt card padding and accent edge); only colours change, plus the display
panel's rounded lower corners and soft shadow.

| Element | Light value |
|---|---|
| App bar | `#1d3e61`, white title and icons |
| Tabs | white, `#1d1d1d` labels; active tab and underline `#1d3e61`; `#e2e5eb` divider |
| Display panel | white, `#e1e1e1` underline, 8 pt lower radius, soft shadow; `#efefef` gap below |
| Day selector | white, `#1d1d1d` letters; selected `#25a89d` circle with white letter |
| Table | header `#eff3f6`, grid `#e6e8ee`, white cells, bold `#1b1b1b` period labels |
| Lesson cards | accent edge unchanged; background = accent mixed into white at **20 %** |
| Bands | `#f6f6f6` home-indicator band |

The 20 % rule reproduces the sampled cards within 1–3 RGB units (mathematics `#cfeafe`,
education `#fff2cc`, Hebrew `#ffddcd`, chemistry `#e8f2da`) and stays within 8 units of the
brief's initial table for the subjects the screenshot does not show.

## Interactions (observed → implemented)

- Tapping a day letter switches the table, keeping the scroll position. Horizontal swipes also
  switch days (RTL: swipe right = next day) via `touch-action: pan-y`, so vertical inertial
  scrolling is never blocked.
- The tab change cross-fades the content, as in the reference.
- The drawer slides in from the right over a light backdrop. It closes on Escape, a backdrop
  tap, or by choosing an item.
- The table header row scrolls with the table; the app bar, tabs, display panel and day bar stay fixed.

## Deliberate deviations & assumptions

| Item | Reference | App | Why |
|---|---|---|---|
| "תצוגה" label colour | `#393e49` | `#9097a2` | The reference contrast is 1.6:1; raised to meet WCAG AA |
| Sidebar header | Official logo, real photo, "כניסה אחרונה" | School icon, "WEBTOP" plus a **לא רשמי** pill, initials avatar, "פתיחה קודמת" (local launch time) | Unofficial: no official assets and no account |
| Bell icon (timetable) | Unknown function | Toggles local change alerts | No fake buttons: it must do something real |
| File icon (timetable) | Unknown function | Export: `.ics` calendar or print/PDF | Same |
| Calendar / filter / file icons (events) | Unknown function | Month view, kind filter, `.ics` export | Same |
| Events tab content | Spinner (loading) | Local list or empty state | No server |
| Home "network messages" / "lesson topics" | Server data | Local notices count / today's lessons | No server; nothing invented |
| Badge "10" on notifications | Server count | Count of local notices; hidden when 0 | |
| Teacher/room values | Real names | Fictional examples in the repository; real values only in a private, gitignored import file | Public repository |
| Bell-off / icon shapes | Material Icons (classic) | Material Symbols Outlined | Close equivalent, Apache-2.0 |
