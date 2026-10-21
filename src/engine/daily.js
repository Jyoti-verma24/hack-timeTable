// Day-to-day help on top of a finished timetable: covering for absent teachers.
// An absence is { teacher, cover: { [placementUid]: substituteTeacherId } } on one date.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// "2026-10-22" -> "Thu" (read as a calendar date, so time zones can't shift it).
export function weekdayOf(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  if (!y || !m || !d) return null;
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// For each absent teacher's classes on `day`, who could take them, best match first.
// Returns [{ teacher, classes: [{ placement, row, assigned, candidates: [...] }] }].
export function coverOptions(project, placements, day, absences) {
  const loads = new Map(project.load.map((l) => [l.id, l]));
  const teachers = new Map(project.teachers.map((t) => [t.id, t]));
  const sections = new Map(project.sections.map((s) => [s.id, s]));
  const absent = new Set(absences.map((a) => a.teacher));
  const today = placements.filter((p) => p.day === day && loads.has(p.loadId));

  // Who is busy when today: their own classes plus covers already assigned.
  // Each entry remembers which class it is, so a cover never blocks itself.
  const busy = new Map(); // "<teacher>|<period>" -> uid of the class they're in
  const periodsToday = new Map(); // teacher -> periods taught today
  const add = (teacherId, pl) => {
    for (let p = pl.start; p < pl.start + pl.len; p++) busy.set(`${teacherId}|${p}`, pl.uid);
    periodsToday.set(teacherId, (periodsToday.get(teacherId) || 0) + pl.len);
  };
  for (const pl of today) {
    const row = loads.get(pl.loadId);
    if (!absent.has(row.teacher)) add(row.teacher, pl);
  }
  const byUid = new Map(today.map((p) => [p.uid, p]));
  for (const a of absences) {
    for (const [uid, sub] of Object.entries(a.cover || {})) {
      if (byUid.has(uid) && sub) add(sub, byUid.get(uid));
    }
  }

  // What each teacher teaches across the week, for "same subject" / "already teaches this class".
  const subjectsOf = new Map();
  const sectionsOf = new Map();
  for (const l of project.load) {
    if (!subjectsOf.has(l.teacher)) subjectsOf.set(l.teacher, new Set());
    if (!sectionsOf.has(l.teacher)) sectionsOf.set(l.teacher, new Set());
    subjectsOf.get(l.teacher).add(l.subject.trim().toLowerCase());
    sectionsOf.get(l.teacher).add(l.section);
  }

  return absences.map((a) => {
    const mine = today
      .filter((pl) => loads.get(pl.loadId).teacher === a.teacher)
      .sort((x, y) => x.start - y.start);
    return {
      teacher: teachers.get(a.teacher),
      classes: mine.map((pl) => {
        const row = loads.get(pl.loadId);
        const dept = sections.get(row.section)?.dept;
        const assigned = a.cover?.[pl.uid] || null;
        const candidates = [];
        for (const t of project.teachers) {
          if (absent.has(t.id)) continue;
          const periods = Array.from({ length: pl.len }, (_, i) => pl.start + i);
          if (periods.some((p) => busy.has(`${t.id}|${p}`) && busy.get(`${t.id}|${p}`) !== pl.uid)) continue;
          if ((t.unavailable || []).some((u) => u.day === day && periods.includes(u.period))) continue;
          const load = (periodsToday.get(t.id) || 0) - (assigned === t.id ? pl.len : 0);
          const max = Number(t.maxPerDay) || 99;
          const notes = [];
          let score = 0;
          if (subjectsOf.get(t.id)?.has(row.subject.trim().toLowerCase())) { score += 40; notes.push(`Teaches ${row.subject}`); }
          if (sectionsOf.get(t.id)?.has(row.section)) { score += 20; notes.push(`Already teaches ${row.section}`); }
          if (t.dept === dept) { score += 15; notes.push('Same department'); }
          if (load > 0) score += 5; // already in college today
          score -= 5 * load;
          notes.push(load ? `${load} period${load > 1 ? 's' : ''} today` : 'No classes today');
          const overLimit = load + pl.len > max;
          if (overLimit) { score -= 30; notes.push(`Over daily limit (${load + pl.len} of ${max})`); }
          candidates.push({ teacher: t, score, notes, overLimit });
        }
        candidates.sort((x, y) => y.score - x.score || x.teacher.name.localeCompare(y.teacher.name));
        return { placement: pl, row, assigned, candidates };
      }),
    };
  });
}
