// Fixed slots are stored one per day ({ day, period, label }) because that's what the
// engine checks. People think of them as "Library, P5, Mon–Fri", so the settings page
// groups slots with the same period and name into one row with several days.

export function groupFixedSlots(fixedSlots, days) {
  const groups = [];
  const byKey = new Map();
  for (const f of fixedSlots || []) {
    const key = `${f.period}|${f.label}`;
    if (!byKey.has(key)) {
      const g = { period: f.period, label: f.label, days: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    const g = byKey.get(key);
    if (!g.days.includes(f.day)) g.days.push(f.day);
  }
  for (const g of groups) g.days.sort((a, b) => days.indexOf(a) - days.indexOf(b));
  return groups;
}

export function ungroupFixedSlots(groups) {
  const seen = new Set();
  const out = [];
  for (const g of groups) {
    for (const day of g.days) {
      const key = `${day}|${g.period}`;
      if (seen.has(key)) continue; // one fixed slot per period per day
      seen.add(key);
      out.push({ day, period: g.period, label: g.label });
    }
  }
  return out;
}
