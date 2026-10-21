// Day-to-day use: mark teachers absent on a date and assign who covers each class.

import { useMemo, useState } from 'react';
import { weekdayOf, coverOptions } from '../engine/daily.js';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const niceDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

export default function DailyScreen({ project, role, update, go, stale }) {
  const [date, setDate] = useState(todayIso);
  const [adding, setAdding] = useState('');
  const [expanded, setExpanded] = useState({});
  const isCoord = role === 'coordinator';
  const tt = project.timetable;
  const day = weekdayOf(date);
  const working = project.settings.days.includes(day);
  const absences = useMemo(() => (project.absences || []).filter((a) => a.date === date), [project.absences, date]);

  const options = useMemo(
    () => (tt && working ? coverOptions(project, tt.placements, day, absences) : []),
    [project, tt, day, working, absences],
  );

  const time = (pl) => `${project.settings.periods[pl.start]?.start}–${project.settings.periods[pl.start + pl.len - 1]?.end}`;
  const periodText = (pl) => (pl.len > 1 ? `P${pl.start + 1}–P${pl.start + pl.len}` : `P${pl.start + 1}`);
  const teacherName = (id) => project.teachers.find((t) => t.id === id)?.name || id;
  const canManage = (teacherId) => isCoord || project.teachers.find((t) => t.id === teacherId)?.dept === role;

  const setAbsences = (fn, label) => update((p) => ({ ...p, absences: fn(p.absences || []) }), label);
  const short = new Date(`${date}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const addAbsent = () => {
    if (!adding) return;
    setAbsences((list) => [...list, { date, teacher: adding, cover: {} }], `Marked ${teacherName(adding)} absent on ${short}`);
    setAdding('');
  };
  const removeAbsent = (teacherId) =>
    setAbsences((list) => list.filter((a) => !(a.date === date && a.teacher === teacherId)), `Removed ${teacherName(teacherId)}'s absence on ${short}`);
  const setCover = (teacherId, uid, sub, label) =>
    setAbsences(
      (list) => list.map((a) => (a.date === date && a.teacher === teacherId ? { ...a, cover: { ...a.cover, [uid]: sub } } : a)),
      label,
    );

  const allClasses = options.flatMap((o) => o.classes.map((c) => ({ ...c, absent: o.teacher })));
  const covered = allClasses.filter((c) => c.assigned).length;
  const addable = project.teachers.filter((t) => canManage(t.id) && !absences.some((a) => a.teacher === t.id));

  if (!tt) {
    return (
      <div className="stack">
        <Head />
        <div className="card empty-state">
          <p style={{ marginBottom: 12 }}>Substitutes are found from the timetable, so generate it first.</p>
          <button className="btn primary" onClick={() => go('timetable')}>Go to Timetable</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <Head />
      {stale && (
        <div className="banner warn no-print">
          <div className="grow">The data changed after the timetable was generated. Suggestions use the timetable as it is now.</div>
        </div>
      )}

      <div className="card card-pad no-print">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <label className="row" style={{ gap: 8 }}>
            <b>Date</b>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <span className="muted">{niceDate(date)}</span>
          <span className="spacer" />
          {working && (
            <>
              <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Teacher who is absent" style={{ minWidth: 230 }}>
                <option value="">Choose a teacher who is absent…</option>
                {addable.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.dept})</option>
                ))}
              </select>
              <button className="btn primary sm" disabled={!adding} onClick={addAbsent}>Mark absent</button>
            </>
          )}
        </div>
      </div>

      {!working ? (
        <div className="banner info no-print"><div className="grow">{day} is not a working day, so there are no classes to cover.</div></div>
      ) : absences.length === 0 ? (
        <div className="card empty-state no-print">Nobody is marked absent on this day. Choose a teacher above to find substitutes for their classes.</div>
      ) : (
        <>
          <div className="result-bar no-print">
            <span className={`badge-big ${covered === allClasses.length ? 'ok' : 'neutral'}`}>
              {covered} of {allClasses.length} class{allClasses.length === 1 ? '' : 'es'} covered
            </span>
            <span className="muted small">{absences.length} teacher{absences.length > 1 ? 's' : ''} absent</span>
            <span className="spacer" />
            <button className="btn sm" onClick={() => window.print()} disabled={!allClasses.length}>Print substitution notice</button>
          </div>

          {options.map(({ teacher, classes }) => (
            <div key={teacher.id} className="card no-print">
              <div className="card-pad absent-head">
                <div>
                  <h3>{teacher.name} <span className="muted small">· {teacher.dept} · absent</span></h3>
                  <span className="muted small">{classes.length ? `${classes.length} class${classes.length > 1 ? 'es' : ''} on ${day}` : `No classes on ${day}, so nothing to cover.`}</span>
                </div>
                {canManage(teacher.id) && <button className="btn sm ghost danger" onClick={() => removeAbsent(teacher.id)}>Not absent</button>}
              </div>
              {classes.map((c) => {
                const key = c.placement.uid;
                const shown = expanded[key] ? c.candidates : c.candidates.slice(0, 4);
                return (
                  <div key={key} className="cover-row">
                    <div className="cover-class">
                      <b>{periodText(c.placement)}</b> <span className="muted">{time(c.placement)}</span>
                      <div>{c.row.subject}{c.row.type === 'lab' && <span className="cell-lab">LAB</span>}</div>
                      <div className="muted small">{c.row.section} · {c.placement.room}</div>
                    </div>
                    <div className="cover-choices">
                      {c.assigned ? (
                        <div className="cover-done">
                          <span>✓ <b>{teacherName(c.assigned)}</b> will take this class</span>
                          {canManage(teacher.id) && (
                            <button className="btn sm ghost" onClick={() => setCover(teacher.id, key, null, `Removed the cover for ${c.row.subject} (${c.row.section})`)}>Change</button>
                          )}
                        </div>
                      ) : c.candidates.length === 0 ? (
                        <div className="muted">No teacher is free at this time. The class may need a free period or to be combined with another.</div>
                      ) : (
                        <>
                          {shown.map((k) => (
                            <div key={k.teacher.id} className={`cover-option ${k.overLimit ? 'over' : ''}`}>
                              <div>
                                <b>{k.teacher.name}</b> <span className="muted small">({k.teacher.dept})</span>
                                <div className="cover-notes">
                                  {k.notes.map((n) => <span key={n} className={`chip ${n.startsWith('Over') ? 'warn' : n.startsWith('Teaches') || n.startsWith('Already') ? 'ok' : 'neutral'}`}>{n}</span>)}
                                </div>
                              </div>
                              {canManage(teacher.id) && (
                                <button
                                  className="btn sm primary"
                                  onClick={() => setCover(teacher.id, key, k.teacher.id, `Assigned ${k.teacher.name} to cover ${c.row.subject} (${c.row.section})`)}
                                >
                                  Assign
                                </button>
                              )}
                            </div>
                          ))}
                          {c.candidates.length > 4 && (
                            <button className="btn ghost sm" onClick={() => setExpanded({ ...expanded, [key]: !expanded[key] })}>
                              {expanded[key] ? 'Show fewer' : `Show all ${c.candidates.length} free teachers`}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          <div className="print-notice">
            <h2>Substitution notice: {niceDate(date)}</h2>
            <p className="muted" style={{ marginBottom: 10 }}>{project.settings.name}</p>
            <table className="notice">
              <thead>
                <tr><th>Period</th><th>Time</th><th>Class</th><th>Subject</th><th>Room</th><th>Absent</th><th>Taken by</th></tr>
              </thead>
              <tbody>
                {[...allClasses].sort((a, b) => a.placement.start - b.placement.start).map((c) => (
                  <tr key={c.placement.uid}>
                    <td>{periodText(c.placement)}</td>
                    <td>{time(c.placement)}</td>
                    <td>{c.row.section}</td>
                    <td>{c.row.subject}</td>
                    <td>{c.placement.room}</td>
                    <td>{c.absent.name}</td>
                    <td><b>{c.assigned ? teacherName(c.assigned) : 'Not covered'}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Head() {
  return (
    <div className="page-head no-print">
      <div>
        <h2>Daily: substitutes</h2>
        <p className="muted">Mark who is absent on a date. For each of their classes, the app lists teachers who are free then, best match first.</p>
      </div>
    </div>
  );
}
