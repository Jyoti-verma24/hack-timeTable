// Soft-quality measures for a clash-free timetable. Lower cost is better.

export function softCost(project, placements) {
  const loadById = new Map(project.load.map((r) => [r.id, r]));

  const sectionDays = new Map(); // "<section>|<day>" -> Set(periods)
  const teacherDays = new Map();
  const subjectDays = new Map(); // "<loadId>|<day>" -> count
  for (const pl of placements) {
    const row = loadById.get(pl.loadId);
    if (!row) continue;
    for (let p = pl.start; p < pl.start + pl.len; p++) {
      addTo(sectionDays, `${row.section}|${pl.day}`, p);
      addTo(teacherDays, `${row.teacher}|${pl.day}`, p);
    }
    const k = `${pl.loadId}|${pl.day}`;
    subjectDays.set(k, (subjectDays.get(k) || 0) + 1);
  }

  // Free periods sandwiched between a section's classes. Lunch isn't a period, so it never counts.
  let gaps = 0;
  for (const periods of sectionDays.values()) {
    const sorted = [...periods].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) gaps += sorted[i] - sorted[i - 1] - 1;
  }

  // Same theory subject more than once on one day.
  let repeats = 0;
  for (const [k, n] of subjectDays) {
    const row = loadById.get(k.split('|')[0]);
    if (row?.type !== 'lab' && n > 1) repeats += n - 1;
  }

  // Teacher teaching more than 3 periods back to back.
  let longRuns = 0;
  for (const periods of teacherDays.values()) {
    const sorted = [...periods].sort((a, b) => a - b);
    let run = 1;
    for (let i = 1; i <= sorted.length; i++) {
      if (i < sorted.length && sorted[i] === sorted[i - 1] + 1) run++;
      else {
        if (run > 3) longRuns += run - 3;
        run = 1;
      }
    }
  }

  // Times a section has to change classroom between two back-to-back theory classes.
  let roomChanges = 0;
  const bySectionDay = new Map();
  for (const pl of placements) {
    const row = loadById.get(pl.loadId);
    if (!row || row.type === 'lab') continue;
    const k = `${row.section}|${pl.day}`;
    if (!bySectionDay.has(k)) bySectionDay.set(k, []);
    bySectionDay.get(k).push(pl);
  }
  for (const list of bySectionDay.values()) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) {
      if (list[i].start === list[i - 1].start + list[i - 1].len && list[i].room !== list[i - 1].room) roomChanges++;
    }
  }

  return { gaps, repeats, longRuns, roomChanges, total: gaps * 2 + repeats * 3 + longRuns * 4 + roomChanges };
}

function addTo(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}
