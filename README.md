# Timetable Optimizer

A web app that builds **clash-free college timetables for any college**. Each department's HOD enters their own teachers, sections and subjects; the coordinator generates the whole college in one run, and an independent checker proves that no teacher, room or class is ever in two places at once.

Built for Hackathon 1, Punjab Jobs AI Bootcamp (J-PAL South Asia).

## Features

- **Try it in one click:** two sample colleges with different shapes (an engineering college with labs and shared rooms; an arts & commerce college with a 6-period day).
- **Works for any college:** days, periods and timings, lunch, short days (e.g. Saturday half-day) and college-wide fixed slots (assembly, sports) are all settings.
- **Departments and roles:** act as the coordinator or as any department's HOD. HODs edit and import only their own department's data and mark it *Submitted*; the coordinator sees every department's status.
- **Data entry:** editable tables, or **CSV import** per table with downloadable templates (made from your Excel sheets), plus CSV export.
- **Check before generating:** plain-language errors and warnings, e.g. "Dr. Kaur has 22 hours assigned but a weekly maximum of 14", or "CSE-3A has 62 students but the biggest lab it can use holds 30. Split the class into batches."
- **Generate:** labs in back-to-back periods that never cross lunch, room type and capacity, department-owned vs shared rooms, teacher unavailability and daily limits.
- **Verified 0 clashes:** a separate checker re-checks every result from scratch.
- **Quality:** subjects spread across the week, few gaps for students, no teacher teaching more than 3 periods in a row, and each section kept in one classroom.
- **Why couldn't this fit?** If a class can't be placed, nothing is forced in. The app says why (e.g. "18 are when Dr. Kaur is already teaching") and what would help.
- **Views:** by class, teacher or room, colour-coded by subject, with lunch, short days, fixed slots and teacher unavailability marked.
- **Print** one timetable or all of them, one per A4 landscape page, for notice boards.
- **Save** the whole college as a project file, and autosave in the browser.

## Setup

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
git clone https://github.com/Jyoti-verma24/hack-timeTable.git
cd hack-timeTable
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173).

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm test` | Run the tests (engine, stress test on 40 random colleges, CSV, permissions) |
| `npm run build` | Build the production site into `dist/` |

### Deploy

It's a static site. On [Vercel](https://vercel.com): **Add New → Project**, import this GitHub repository, and keep the detected settings (framework **Vite**, build `npm run build`, output `dist`).

## Usage

1. **Start:** on the home page, load a sample college, start a new one, or open a saved project file.
2. **College & timings** (coordinator): set working days, periods and their times, the lunch break, short days and fixed slots.
3. **Data:** add departments, rooms, teachers, sections and the teaching load. For each table you can **Download template**, fill it in Excel, save as CSV and **Import CSV**.
   - *Teaching load:* one row per subject per section. "Periods together" is 1 for a lecture and 2–3 for a lab.
   - *Teachers:* "Unavailable" uses a form like `Fri 5-8; Mon 1`.
   - *Rooms:* the owner is a department code, or `shared` for rooms every department may use.
4. **Departments:** switch **Acting as** to an HOD to see what they see. Each HOD fills in their department and clicks **Mark as submitted** on the Overview.
5. **Check data:** fix every error (warnings are allowed).
6. **Timetable** (coordinator): click **Generate timetable**. Browse by **Class / Teacher / Room**, and **Print** one or all. **Try another version** gives a different valid timetable.
7. **Save project file** to keep your work or share it with another coordinator.

### CSV columns

| File | Columns |
|---|---|
| departments.csv | code, name, hod |
| rooms.csv | name, type, capacity, department |
| teachers.csv | id, name, department, max_per_week, max_per_day, unavailable |
| sections.csv | name, department, semester, students |
| teaching_load.csv | section, subject, teacher_id, type, hours_per_week, block_length, room_type |

## How it works

The generator uses the **two-phase hybrid** approach from university course timetabling. It places the most constrained class first (labs, scarce rooms, busy teachers), picks the best valid slot by a quality score, and when a class has no valid slot it moves the classes blocking it and re-places them. It runs several seeded attempts and keeps the best. Hard rules are never broken, and the result is re-verified by an independent checker. See [CLAUDE.md](CLAUDE.md) for the full design.

## Roadmap (Stage 2)

Drag-and-drop editing with live clash checks, lock and regenerate, substitute finder for absent teachers, free-room finder, load and room-use dashboards, lab batches and electives, share links for students and teachers, real logins per department, a CP-SAT "best quality" solver, and a Claude-powered Timetable Assistant chatbot.
