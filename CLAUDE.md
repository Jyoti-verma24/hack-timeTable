# Timetable Optimizer

A web app that generates clash-free college timetables for **any** college. Built for Hackathon 1, Punjab Jobs AI Bootcamp (J-PAL South Asia).

Two graded stages:
- **Stage 1 (in class):** a core that works: data in → check → generate → view → print.
- **Stage 2 (by Tuesday):** a full product, fully tested: editing, insights, sharing, logins, CP-SAT "best quality" mode and the Claude chatbot.

## Commands

```bash
npm install        # once
npm run dev        # local dev server (Vite)
npm test           # Vitest: engine unit tests + random-college stress test
npm run build      # production build into dist/
```

## Stack

- Vite + React 18 (plain JavaScript, no TypeScript), Vitest for tests.
- Deployed on Vercel. No backend in Stage 1; everything runs in the browser.
- Stage 2 adds: Vercel serverless functions (`api/`), Supabase (logins + database), a Python CP-SAT service, Playwright browser tests.

## Core principles

1. **No college is hard-coded.** Days, periods, timings, lunch, half-days, fixed slots, rooms, teachers, sections and teaching load are all data. `src/samples/` holds demo colleges only.
2. **Hard rules are never broken.** The generator either places a class cleanly or reports it as unplaced with a reason. It never outputs a clash.
3. **Every result is verified independently.** `src/engine/check.js` re-checks the timetable from scratch and shares no logic with the generator on purpose. The "0 clashes ✓" badge comes from this checker, never from the generator.
4. **The engine is pure logic.** `src/engine/` has no React, DOM or network code. The UI, the tests, the CP-SAT comparison and the chatbot tools all call the same engine functions.
5. **Explain, don't just fail.** Bad data gets a plain-language message (`validate.js`); an unplaced class gets a reason and a tip (`explain.js`). Messages name the teacher, section or room involved.

## Structure

```
src/
  engine/              pure logic, fully unit-tested
    model.js           shared helpers: periodsOn, blockFits, expandUnits, eligibleRooms, seeded RNG
    time.js            clock times, the day's timeline of periods and breaks, reflow
    generate.js        solver (see Algorithm)
    check.js           independent clash checker
    validate.js        data checks before generating -> [{ level, area, dept, message }]
    explain.js         "why couldn't this fit?" for an unplaced unit
    score.js           soft-quality cost: student gaps, same-subject repeats, long teacher runs
    moves.js           moving a placed class by hand: moveOptions (green slot + room, or the reasons it can't go), applyMove (moved classes get locked), setLocked
  io/
    csv.js             CSV parse/write + TABLES spec (one column list drives templates, import, export and editable tables)
    project.js         empty/normalize/save/load project, rowDept/canEdit permissions, renameRefs
    slots.js           "Fri 5-8; Mon 1" <-> [{ day, period }]
  samples/index.js     demo colleges (engineering, arts & commerce)
  ui/                  one file per screen + shared components
  App.jsx, main.jsx, styles.css
tests/
  engine.test.js       samples, stress, checker, validation, explanations
  randomCollege.js     random feasible college generator for stress tests
```

## Data model (one college = one project, saved as one JSON file)

```
settings     { name, days: ["Mon",...], periods: [{label,start,end}], breaks: [{after, label, start, end, blocksLabs}], halfDays: {Sat: 4}, fixedSlots: [{day, period, label}] }
departments  [{ id (code), name, hod }]
rooms        [{ id (name), type, capacity, dept: <dept id> | "shared" }]
teachers     [{ id, name, dept, maxPerWeek, maxPerDay, unavailable: [{day, period}] }]
sections     [{ id (name), dept, semester, students }]
load         [{ id, section, subject, teacher, type: "theory"|"lab", hours, block, roomType }]
status       { <dept id>: "draft" | "submitted" }
timetable    { placements: [{ uid, loadId, day, start, len, room, locked? }], unplaced, ms, fingerprint, generatedAt, manualMoves } | null
```

- **Periods are 0-based in data, 1-based in anything a person reads or types** (UI, CSV, messages: "P3", "Fri 5-8").
- A break sits between periods: `after: 4` means it comes after the 4th period. Breaks have their own start/end times. A block may not run through a break unless `blocksLabs: false` (e.g. a short tea break). Lunch always blocks.
- Times are "HH:MM" strings; `src/engine/time.js` has `toMin`/`hhmm`, `timeline` (periods and breaks in order) and `reflow` (re-time everything after an entry, keeping lengths). Old projects with `lunchAfter` are migrated in `normalizeProject`.
- References use IDs. Renaming an ID in the UI goes through `renameRefs` so nothing breaks.
- A placement stores only what/when/where; teacher and section come from its `load` row.
- `timetable.fingerprint` (from `dataFingerprint`) detects that data changed after generating, which shows a "regenerate" banner.

## Rules

**Hard (never broken):** no teacher, room or section double-booked; room type matches; room capacity ≥ students; room is shared or owned by the section's department; teacher unavailability and daily maximum respected; college-wide fixed slots kept free; blocks stay inside the day and never run through lunch (or any break not marked `blocksLabs: false`); half-days respected.

**Soft (scored, lower is better):** subject spread across the week, balanced days, compact student days (few gaps), no more than 3 periods in a row for a teacher, mornings slightly preferred, own-department rooms before shared ones, smallest room that fits.

## Algorithm

Two-phase hybrid (classic university course timetabling):

1. **Construct (Stage 1, `generate.js`):** split load rows into units (4 theory hours → four 1-period units; a 3-hour lab with block 3 → one 3-period unit). Repeatedly pick the unit with the fewest valid options (DSatur-style, longer blocks first), place it in its lowest-penalty slot. If none exists, evict the cheapest set of blocking units, place it, and re-queue the evicted ones (bounded by an eviction budget). Several seeded restarts; keep the result with the fewest unplaced, then the lowest soft cost. Deterministic for a given seed.
2. **Improve (Stage 2):** simulated annealing over move/swap, accepting only moves that keep 0 clashes. Supports locked placements and minimal-change re-solves.
3. **CP-SAT "Best quality" mode (Stage 2):** a Python service (FastAPI + Google OR-Tools CP-SAT) models the same hard rules as constraints and soft rules as the objective. Its output goes through the **same** `check.js`. The browser hybrid stays the default and the fallback if the service is slow or down.

## Roles and workflow

| Role | Can do |
|---|---|
| Coordinator | Everything: college settings, departments, shared rooms, generate the whole college, publish |
| HOD (one per department) | Edit own department's rooms, teachers, sections and teaching load; mark department Submitted; view everything |
| Teacher / Student (Stage 2) | View own timetable; teachers enter unavailability |

- The coordinator generates **the whole college in one run**, never department by department, because shared rooms and teachers make separate runs clash.
- Permissions: `rowDept(table, row, project)` gives a row's department (`null` = college-wide, coordinator only), and `canEdit(role, dept)` decides. HOD CSV imports replace only their own department's rows.
- Stage 1 demonstrates roles with an "Acting as" switcher (no real login). Stage 2 enforces them with Supabase auth and row-level security.

## Claude API (chatbot only)

- The Claude API is used **only** for the Stage 2 "Timetable Assistant" chatbot. Never use it to generate or check timetables.
- **The API key never goes in browser code.** It lives in a Vercel environment variable, read only by `api/chat.js`. Never commit `.env*` files (they're in `.gitignore`).
- The chatbot answers by calling engine functions as tools (free slots, free rooms, substitutes, explain unplaced, propose a move). Any change it proposes must pass `check.js` and be confirmed by the user before it is applied.
- Chatbot tests mock the API so they cost no credit.

## Conventions

- Plain JS modules, 2-space indent, single quotes. Match the surrounding code's comment density: a short comment explaining *why*, not *what*.
- Colours and spacing are CSS custom properties on `:root` in `src/styles.css`. Add a named token rather than a raw colour in a component.
- Keep the print styles (A4 landscape, one timetable per page) and the `prefers-reduced-motion` rule working when changing CSS.
- `localStorage` only for autosave convenience, always wrapped in try/catch; the project JSON file is the real save.
- Every engine change needs a test in `tests/`. The stress test (random colleges → 0 clashes) must keep passing.

## Working style

- Commit small working steps; the app must build and `npm test` must pass after every commit.
- Clear commit messages that say what changed (e.g. "Add independent clash checker").
- Push to GitHub only when asked.
