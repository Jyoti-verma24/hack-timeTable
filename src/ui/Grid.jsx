// One week grid for a section, teacher or room. Rows are days, columns are periods,
// with lunch as its own narrow column. Multi-period blocks span their columns.

import { periodsOn } from '../engine/model.js';

const PALETTE = [
  ['#e7efff', '#3b63c9'], ['#e5f5ec', '#23875a'], ['#fff1df', '#c27a12'], ['#f3e8ff', '#7c4bc4'],
  ['#ffe8ec', '#c5405a'], ['#e1f6f8', '#178895'], ['#f4f1dc', '#8a7a12'], ['#ffeadb', '#c25a1c'],
  ['#e9ecff', '#4d55c7'], ['#e8f6df', '#4c8a1f'], ['#fde7f6', '#b03f8f'], ['#e6eef4', '#456a85'],
];
export function subjectColour(subject) {
  let h = 0;
  for (const ch of subject || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function Grid({ project, placements, view, id }) {
  const { settings } = project;
  const P = settings.periods.length;
  const lunch = settings.lunchAfter || 0;
  const loads = new Map(project.load.map((l) => [l.id, l]));
  const teachers = new Map(project.teachers.map((t) => [t.id, t]));
  const teacher = view === 'teacher' ? teachers.get(id) : null;

  const starts = new Map();
  const covered = new Set();
  for (const pl of placements) {
    const row = loads.get(pl.loadId);
    if (!row) continue;
    const mine = (view === 'section' && row.section === id) || (view === 'teacher' && row.teacher === id) || (view === 'room' && pl.room === id);
    if (!mine) continue;
    starts.set(`${pl.day}|${pl.start}`, { pl, row });
    for (let p = pl.start + 1; p < pl.start + pl.len; p++) covered.add(`${pl.day}|${p}`);
  }
  const fixed = new Map((settings.fixedSlots || []).map((f) => [`${f.day}|${f.period}`, f.label]));
  const unavailable = new Set((teacher?.unavailable || []).map((u) => `${u.day}|${u.period}`));

  const header = [];
  settings.periods.forEach((p, i) => {
    if (lunch > 0 && i === lunch) header.push(<th key="lunch" className="lunch-h" aria-label="Lunch" />);
    header.push(
      <th key={i}>
        P{i + 1}
        <span className="time">{p.start}–{p.end}</span>
      </th>,
    );
  });

  return (
    <div className="tt-wrap">
      <table className="tt">
        <thead>
          <tr>
            <th className="day" />
            {header}
          </tr>
        </thead>
        <tbody>
          {settings.days.map((day, di) => {
            const n = periodsOn(settings, day);
            const cells = [];
            for (let p = 0; p < P; p++) {
              if (lunch > 0 && p === lunch && di === 0) {
                cells.push(<td key="lunch" className="lunch" rowSpan={settings.days.length}>LUNCH</td>);
              }
              const key = `${day}|${p}`;
              if (covered.has(key)) continue;
              if (p >= n) {
                cells.push(<td key={p} className="off" title="No classes (short day)" />);
                continue;
              }
              const hit = starts.get(key);
              if (hit) {
                const [bg, accent] = subjectColour(hit.row.subject);
                const t = teachers.get(hit.row.teacher);
                const lines =
                  view === 'section' ? [t?.name || hit.row.teacher, hit.pl.room]
                    : view === 'teacher' ? [hit.row.section, hit.pl.room]
                      : [hit.row.section, t?.name || hit.row.teacher];
                cells.push(
                  <td key={p} colSpan={hit.pl.len} className="class" style={{ background: bg, borderLeftColor: accent }}>
                    <div className="cell-subject">
                      {hit.row.subject}
                      {hit.row.type === 'lab' && <span className="cell-lab">LAB</span>}
                    </div>
                    {lines.map((l, i) => (
                      <div key={i} className="cell-line" title={l}>{l}</div>
                    ))}
                  </td>,
                );
              } else if (fixed.has(key)) {
                cells.push(<td key={p} className="fixed">{fixed.get(key)}</td>);
              } else if (unavailable.has(key)) {
                cells.push(<td key={p} className="unavail">Unavailable</td>);
              } else {
                cells.push(<td key={p} className="empty" />);
              }
            }
            return (
              <tr key={day}>
                <th className="day">{day}</th>
                {cells}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
