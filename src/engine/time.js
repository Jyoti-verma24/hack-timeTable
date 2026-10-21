// Clock-time helpers and the day's timeline (periods with breaks between them).
// A break sits between periods: `after` is how many periods come before it.

export const toMin = (t) => (/^\d{1,2}:\d{2}/.test(t || '') ? Number(t.split(':')[0]) * 60 + Number(t.split(':')[1].slice(0, 2)) : null);
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function breaksOf(settings) {
  return (settings.breaks || [])
    .map((b, index) => ({ ...b, index }))
    .filter((b) => b.after > 0 && b.after < settings.periods.length)
    .sort((a, b) => a.after - b.after);
}

// Ordered list of everything in a day: { kind: 'period' | 'break', index, item }.
export function timeline(settings) {
  const breaks = breaksOf(settings);
  const out = [];
  settings.periods.forEach((p, i) => {
    out.push({ kind: 'period', index: i, item: p });
    for (const b of breaks.filter((x) => x.after === i + 1)) out.push({ kind: 'break', index: b.index, item: settings.breaks[b.index] });
  });
  return out;
}

const duration = (item, fallback) => {
  const s = toMin(item.start);
  const e = toMin(item.end);
  return s != null && e != null && e > s ? e - s : fallback;
};

// Re-time everything after one entry so nothing overlaps, keeping each entry's length.
// `from` is { kind, index }; with no `from`, the whole day is laid out from P1's start.
export function reflow(settings, from, { periodMinutes, dayStart } = {}) {
  const periods = settings.periods.map((p) => ({ ...p }));
  const breaks = (settings.breaks || []).map((b) => ({ ...b }));
  const line = timeline({ ...settings, periods, breaks });
  let pos = from ? line.findIndex((x) => x.kind === from.kind && x.index === from.index) : -1;
  let cursor;
  if (pos >= 0) cursor = toMin(line[pos].item.end);
  else cursor = toMin(dayStart) ?? toMin(periods[0]?.start) ?? 9 * 60;
  for (let i = pos + 1; i < line.length; i++) {
    const { kind, index } = line[i];
    const target = kind === 'period' ? periods[index] : breaks[index];
    const len = kind === 'period' ? periodMinutes || duration(target, 50) : duration(target, 10);
    target.start = hhmm(cursor);
    target.end = hhmm(cursor + len);
    cursor += len;
  }
  return { ...settings, periods, breaks };
}
