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
| כרטיס תלמיד → מערכת שעות | Light screenshot | `StudentCardTimetableScreen`: matches the screenshot to within 1pt (see below) |
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
| Timetable | inset 16 pt | A CSS grid (see "Timetable grid" below). 1 pt lines `#2d323f`, outline `#272f3f` |
| Header row | 45 | bg `#252d3c`, 12 pt bold, "שעה/יום" plus day name; sticky |
| Period column | 25 % | 12 pt bold, centred. "8:50-8:00 .1" visual order, reproduced with the bidi-neutral U+2010 hyphen |
| Lesson card | 62 tall (3 lines) | 4 pt margin, padding and radius; 18 pt line height, centred 12 pt text (subject bold), 4 pt accent on the start (right) edge |
| Empty period row | 34.5333 | blank cell. Rows are never removed |
| Space below last row | 72 | clears the FAB |
| Scroll-to-top FAB | 56 | white, bottom-right, 16 pt from the right and bottom edges; appears after scrolling |
| Sidebar | 321 wide | header 111 pt (`#0f2135` + waves), subtitle row 46 pt, items 46 pt, 20 pt icons, active item `#a8caf6` bold plus 4 pt bar |
| Notices sections | header 42, row 47, 16 between | bg `#181e26`, 14 pt bold text |

Residual difference against matching frames, cropped to the app area: mean absolute error is
about 4–6 of 255 per channel, almost entirely text anti-aliasing (iOS CoreText vs Chromium).

### כרטיס תלמיד → מערכת שעות (light screenshot, 402×874 pt)

Same app bar, day bar and table as the main timetable, with three differences:

| Region | Measurement | Notes |
|---|---|---|
| App bar | 55 | Back arrow where the menu button is (centred 36pt from the right edge), title "מערכת שעות" from 56pt, export and change-alert icons as on the main screen |
| Name card | 66 | Replaces the tabs and the "תצוגה" panel: label "שם התלמיד/ה" 10.5pt semi-bold (glyphs from 16pt), name 14pt (glyphs from 37pt), underline at 57.5pt, rounded lower corners and soft shadow (light) |
| Table offset | 10 | The table starts 10pt below the 58pt day bar |

### Timetable grid (measured from Webtop's DOM at a 393px viewport)

| Measurement | Webtop | This app | Notes |
|---|---|---|---|
| Layout | CSS grid, 2 columns | CSS grid: a 45px header row, then one row per period, each `25% 75%` | `role="table"` with rows, row headers and cells |
| Width at 393px | 361.07 | 361 | 100% of the space between the 16px gutters, so it follows the screen (328 at 360, 398 at 430) |
| Columns | 25% times (right) · 75% lessons (left) | same | |
| Header | 45, `#EFF2F7`, padding 8px 4px, bold 12px, centred, sticky | same (dark theme keeps its own header colour) | |
| Empty period | 34.5333 | 34.53 (Chromium rounds to 1/64 px) | minimum row height |
| Lesson row, 3-line card | 69.5333 | 70 | 4px margin + 4px padding + 3 × 18px lines + 4px + 4px = 70; reaching 69.5333 would need clipped text, so rows grow to their card |
| Card | 4px margin, padding, radius; 12px/18px; bold subject; coloured right edge; subject colour at 20% | same | the 20% tint is the colour mixed into the white cell (identical result); dark mode keeps the 16% measured from the dark recording |
| Top margin | 46 | 0 on the main screen, 10 on the Student Card | Webtop reserves 46px above the grid for its day selector; here the day bar (58pt, measured) is its own element directly above the grid, so the table starts where the recording and screenshots show it |
| Period labels | — | 12px bold from a ~386px-wide screen | below that they shrink with the 25% column (9.5px at 320) instead of overflowing; not measured in Webtop at those widths |

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
| Table | header `#eff2f7` (Webtop's DOM value), grid `#e6e8ee`, white cells, bold `#1b1b1b` period labels |
| Lesson cards | accent edge unchanged; background = accent mixed into white at **20 %** |
| Bands | `#f6f6f6` home-indicator band |

The 20 % rule reproduces the sampled cards within 1–3 RGB units (mathematics `#cfeafe`,
education `#fff2cc`, Hebrew `#ffddcd`, chemistry `#e8f2da`) and stays within 8 units of the
brief's initial table for the subjects the screenshot does not show.

## Interactions (observed → implemented)

- Tapping a day letter switches the table, keeping the scroll position. This is the only way
  to change the day: horizontal swipes on the table do nothing, and vertical scrolling is
  native.
- The tab change cross-fades the content, as in the reference.
- The drawer slides in from the right over a light backdrop. It closes on Escape, a backdrop
  tap, or by choosing an item.
- The header row of the timetable stays at the top while the lessons scroll (sticky); the app
  bar, tabs, display panel and day bar stay fixed.

## Deliberate deviations & assumptions

| Item | Reference | App | Why |
|---|---|---|---|
| "תצוגה" label colour | `#393e49` | `#9097a2` | The reference contrast is 1.6:1; raised to meet WCAG AA |
| Sidebar header | Official logo, real photo, "כניסה אחרונה" | School icon and the app's own name ("מערכת שעות"), profile picture or initials, "פתיחה קודמת" (local launch time) | Not the official app: no official assets or brand; Settings → אודות explains what the app is |
| Bell icon (timetable) | Unknown function | Toggles local change alerts | No fake buttons: it must do something real |
| File icon (timetable) | Unknown function | Export: `.ics` calendar or print/PDF | Same |
| Calendar / filter / file icons (events) | Unknown function | Month view, kind filter, `.ics` export | Same |
| Events tab content | Spinner (loading) | Local list or empty state | No server |
| Home "network messages" / "lesson topics" | Server data | Local notices count / today's lessons | No server; nothing invented |
| Badge "10" on notifications | Server count | Count of local notices; hidden when 0 | |
| Teacher/room values | Real names | Fictional examples in the repository; real values only in a private, gitignored import file | Public repository |
| Bell-off / icon shapes | Material Icons (classic) | Material Symbols Outlined | Close equivalent, Apache-2.0 |
