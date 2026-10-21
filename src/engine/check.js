// Independent checker: re-verifies a finished timetable from scratch.
// It shares no logic with the generator on purpose, so a generator bug can't hide.

export function checkTimetable(project, placements) {
  const { settings } = project;
  const loads = new Map(project.load.map((r) => [r.id, r]));
  const teachers = new Map(project.teachers.map((t) => [t.id, t]));
  const sections = new Map(project.sections.map((s) => [s.id, s]));
  const rooms = new Map(project.rooms.map((r) => [r.id, r]));
  const P = settings.periods.length;
  const lunch = settings.lunchAfter || 0;
  const fixed = new Map((settings.fixedSlots || []).map((f) => [`${f.day}|${f.period}`, f.label]));

  const clashes = [];
  const add = (kind, message) => clashes.push({ kind, message });
  const slot = (day, p) => `${day} P${p + 1}`;

  const occ = { teacher: new Map(), room: new Map(), section: new Map() };
  const teacherDay = new Map();
  const placedHours = new Map();

  for (const pl of placements) {
    const row = loads.get(pl.loadId);
    if (!row) {
      add('data', `A placed class refers to teaching-load row "${pl.loadId}", which no longer exists.`);
      continue;
    }
    const teacher = teachers.get(row.teacher);
    const section = sections.get(row.section);
    const room = rooms.get(pl.room);
    const what = `${row.subject} (${row.section})`;
    placedHours.set(row.id, (placedHours.get(row.id) || 0) + pl.len);

    const dayLength = settings.halfDays?.[pl.day] ? Math.min(settings.halfDays[pl.day], P) : P;
    if (!settings.days.includes(pl.day)) add('time', `${what} is on ${pl.day}, which is not a working day.`);
    if (pl.start < 0 || pl.start + pl.len > dayLength) add('time', `${what} runs past the end of ${pl.day}.`);
    if (lunch > 0 && pl.start < lunch && pl.start + pl.len > lunch) add('time', `${what} runs through the lunch break on ${pl.day}.`);

    if (!room) add('room', `${what} is in room "${pl.room}", which does not exist.`);
    else {
      if (room.type !== row.roomType) add('room', `${what} needs a ${row.roomType} but is in ${room.id} (${room.type}).`);
      if (section && Number(room.capacity) < Number(section.students)) {
        add('room', `${what} has ${section.students} students but ${room.id} holds only ${room.capacity}.`);
      }
      if (section && room.dept !== 'shared' && room.dept !== section.dept) {
        add('room', `${what} is in ${room.id}, which belongs to ${room.dept}, not ${section.dept}.`);
      }
    }

    for (let p = pl.start; p < pl.start + pl.len; p++) {
      if (fixed.has(`${pl.day}|${p}`)) add('time', `${what} is placed in the college-wide "${fixed.get(`${pl.day}|${p}`)}" slot on ${slot(pl.day, p)}.`);
      if (teacher?.unavailable?.some((u) => u.day === pl.day && u.period === p)) {
        add('teacher', `${teacher.name} is unavailable on ${slot(pl.day, p)} but teaches ${what}.`);
      }
      for (const [kind, id, label] of [
        ['teacher', row.teacher, teacher?.name || row.teacher],
        ['room', pl.room, pl.room],
        ['section', row.section, row.section],
      ]) {
        const key = `${id}|${pl.day}|${p}`;
        const other = occ[kind].get(key);
        if (other) add(kind, `${label} is booked twice on ${slot(pl.day, p)}: ${other} and ${what}.`);
        else occ[kind].set(key, what);
      }
    }
    const tk = `${row.teacher}|${pl.day}`;
    teacherDay.set(tk, (teacherDay.get(tk) || 0) + pl.len);
  }

  for (const [key, n] of teacherDay) {
    const [tid, day] = key.split('|');
    const t = teachers.get(tid);
    if (t && Number(t.maxPerDay) && n > Number(t.maxPerDay)) {
      add('teacher', `${t.name} teaches ${n} periods on ${day}, over the daily limit of ${t.maxPerDay}.`);
    }
  }

  const missing = [];
  for (const row of project.load) {
    const need = Number(row.hours) || 0;
    const got = placedHours.get(row.id) || 0;
    if (got > need) add('data', `${row.subject} (${row.section}) has ${got} hours placed but needs only ${need}.`);
    if (got < need) missing.push({ loadId: row.id, missing: need - got });
  }

  return { clashes, missing };
}
