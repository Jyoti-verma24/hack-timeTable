import { useEffect, useMemo, useState } from 'react';
import { generate } from '../engine/generate.js';
import { checkTimetable } from '../engine/check.js';
import { explainUnplaced } from '../engine/explain.js';
import { softCost } from '../engine/score.js';
import { dataFingerprint } from '../engine/model.js';
import { moveOptions, applyMove, setLocked } from '../engine/moves.js';
import Grid from './Grid.jsx';

const VIEWS = [
  { key: 'section', label: 'Class', plural: 'sections' },
  { key: 'teacher', label: 'Teacher', plural: 'teachers' },
  { key: 'room', label: 'Room', plural: 'rooms' },
];

export default function TimetableScreen({ project, role, errorCount, stale, update, go, notify }) {
  const isCoord = role === 'coordinator';
  const tt = project.timetable;
  const [view, setView] = useState('section');
  const [dept, setDept] = useState(isCoord ? 'all' : role);
  const [entity, setEntity] = useState('');
  const [busy, setBusy] = useState(false);
  const [printAll, setPrintAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);

  const entities = useMemo(() => {
    const inDept = (d) => dept === 'all' || d === dept;
    if (view === 'section') return project.sections.filter((s) => inDept(s.dept)).map((s) => ({ id: s.id, label: s.id }));
    if (view === 'teacher') return project.teachers.filter((t) => inDept(t.dept)).map((t) => ({ id: t.id, label: t.name || t.id }));
    return project.rooms.filter((r) => inDept(r.dept) || r.dept === 'shared').map((r) => ({ id: r.id, label: `${r.id}${r.dept === 'shared' ? ' (shared)' : ''}` }));
  }, [project, view, dept]);

  const current = entities.some((e) => e.id === entity) ? entity : entities[0]?.id;
  const idx = entities.findIndex((e) => e.id === current);

  const verdict = useMemo(() => (tt ? checkTimetable(project, tt.placements) : null), [project, tt]);
  const quality = useMemo(() => (tt ? softCost(project, tt.placements) : null), [project, tt]);
  const totalHours = project.load.reduce((a, l) => a + (Number(l.hours) || 0), 0);
  const placedHours = tt ? tt.placements.reduce((a, p) => a + p.len, 0) : 0;

  const options = useMemo(
    () => (tt && selected ? moveOptions(project, tt.placements, selected) : new Map()),
    [project, tt, selected],
  );
  const selectedInfo = useMemo(() => {
    const pl = tt?.placements.find((p) => p.uid === selected);
    const row = pl && project.load.find((l) => l.id === pl.loadId);
    if (!row) return null;
    const free = [...options.values()].filter((o) => o.ok).length;
    return { pl, row, free };
  }, [tt, selected, options, project]);

  useEffect(() => {
    if (!editing) return undefined;
    const onKey = (e) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  // HODs may move only their own department's classes; the coordinator may move any.
  const canMove = (pl, row) => isCoord || project.sections.find((s) => s.id === row.section)?.dept === role;

  const moveTo = (day, start) => {
    const opt = options.get(`${day}|${start}`);
    if (!opt?.ok || !selectedInfo) return;
    const moved = applyMove(tt.placements, selected, day, start, opt.room);
    const { clashes } = checkTimetable(project, moved);
    if (clashes.length) {
      notify(`Not moved: ${clashes[0].message}`);
      return;
    }
    update((p) => ({ ...p, timetable: { ...p.timetable, placements: moved, manualMoves: (p.timetable.manualMoves || 0) + 1 } }));
    notify(`Moved ${selectedInfo.row.subject} (${selectedInfo.row.section}) to ${day} P${start + 1}, room ${opt.room}, and locked it there. Still 0 clashes.`);
    setSelected(null);
    setHover(null);
  };

  const lockedCount = tt ? tt.placements.filter((p) => p.locked).length : 0;
  const setLock = (uids, locked) => {
    update((p) => ({ ...p, timetable: { ...p.timetable, placements: setLocked(p.timetable.placements, uids, locked) } }));
  };
  // Classes in the timetable on screen that this role may lock or unlock.
  const inView = (tt?.placements || []).filter((pl) => {
    const row = project.load.find((l) => l.id === pl.loadId);
    if (!row || !canMove(pl, row)) return false;
    return (view === 'section' && row.section === current) || (view === 'teacher' && row.teacher === current) || (view === 'room' && pl.room === current);
  });

  useEffect(() => {
    if (!printAll) return;
    document.body.classList.add('printing-all');
    window.print();
    document.body.classList.remove('printing-all');
    setPrintAll(false);
  }, [printAll]);

  const run = (seed) => {
    setBusy(true);
    setSelected(null);
    // Let the button repaint before the solver blocks the main thread.
    setTimeout(() => {
      const locked = (tt?.placements || []).filter((p) => p.locked);
      const res = generate(project, { seed, locked });
      update((p) => ({
        ...p,
        timetable: {
          placements: res.placements,
          unplaced: res.unplaced,
          droppedLocks: res.droppedLocks,
          ms: res.ms,
          seed,
          fingerprint: dataFingerprint(p),
          generatedAt: new Date().toISOString(),
        },
      }));
      setBusy(false);
      const parts = [`Generated in ${(res.ms / 1000).toFixed(1)} s.`];
      if (res.keptLocked) parts.push(`Kept ${res.keptLocked} locked class(es) in place.`);
      if (res.droppedLocks.length) parts.push(`${res.droppedLocks.length} locked class(es) had to move; see why above the timetable.`);
      parts.push(res.unplaced.length ? `${res.unplaced.length} class(es) could not be placed; see why below.` : 'Every class placed.');
      notify(parts.join(' '));
    }, 30);
  };

  const entityLabel = entities.find((e) => e.id === current)?.label;
  const viewInfo = VIEWS.find((v) => v.key === view);

  return (
    <div className="stack">
      <div className="page-head no-print">
        <div>
          <h2>Timetable</h2>
          <p className="muted">The whole college is generated at once, so shared rooms and teachers never clash between departments.</p>
        </div>
        {isCoord && tt && (
          <div className="row">
            <button
              className="btn"
              disabled={busy || errorCount > 0}
              onClick={() => run((tt.seed || 1) + 1)}
              title={lockedCount ? 'A different valid version of everything that is not locked' : 'Make a different valid version'}
            >
              Try another version
            </button>
            <button
              className="btn primary big"
              disabled={busy || errorCount > 0}
              onClick={() => run(tt.seed || 1)}
              title={lockedCount ? 'Rebuild everything around the locked classes. Unlock everything to start completely fresh.' : 'Build the timetable again'}
            >
              {busy ? <><span className="spinner" /> Generating…</> : lockedCount ? `Regenerate (keeps ${lockedCount} locked)` : 'Regenerate'}
            </button>
          </div>
        )}
      </div>

      {errorCount > 0 && (
        <div className="banner err no-print">
          <div className="grow"><b>{errorCount} data error(s)</b> must be fixed before generating.</div>
          <button className="btn sm" onClick={() => go('check')}>See problems</button>
        </div>
      )}
      {!isCoord && !tt && (
        <div className="banner info no-print"><div className="grow">The coordinator generates the timetable once every department has submitted its data.</div></div>
      )}
      {stale && (
        <div className="banner warn no-print">
          <div className="grow"><b>The data changed after this timetable was generated.</b> {isCoord ? 'Regenerate to include the changes.' : 'Ask the coordinator to regenerate.'}</div>
        </div>
      )}

      {tt && verdict && (
        <>
          <div className="result-bar no-print">
            {verdict.clashes.length === 0 ? (
              <span className="badge-big ok" title="Re-checked from scratch by a separate checker">✓ 0 clashes · verified</span>
            ) : (
              <span className="badge-big err">✕ {verdict.clashes.length} problem(s) found by the checker</span>
            )}
            <span className={`badge-big ${placedHours === totalHours ? 'ok' : 'err'}`}>{placedHours} / {totalHours} hours placed</span>
            <span className="badge-big neutral">Student gaps: {quality.gaps}</span>
            <span className="badge-big neutral">Teacher runs over 3: {quality.longRuns}</span>
            <span className="badge-big neutral" title="Back-to-back classes where students must walk to another room">Room changes: {quality.roomChanges}</span>
            {lockedCount > 0 && (
              <span className="badge-big neutral" title="Locked classes stay where they are when you regenerate">
                🔒 {lockedCount} locked
                {isCoord && (
                  <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => setLock(tt.placements.filter((p) => p.locked).map((p) => p.uid), false)}>
                    Unlock everything
                  </button>
                )}
              </span>
            )}
            <span className="muted small">Generated in {(tt.ms / 1000).toFixed(1)} s · {new Date(tt.generatedAt).toLocaleString()}</span>
          </div>

          {verdict.clashes.length > 0 && (
            <div className="card no-print">
              <div className="card-pad"><h3>Checker findings</h3></div>
              {verdict.clashes.slice(0, 20).map((c, i) => (
                <div key={i} className="issue error"><span className="icon">✕</span><div className="text">{c.message}</div></div>
              ))}
            </div>
          )}

          {tt.droppedLocks?.length > 0 && <DroppedLocks project={project} dropped={tt.droppedLocks} />}
          {tt.unplaced.length > 0 && <Unplaced project={project} tt={tt} />}

          <div className="card card-pad screen-only-tt">
            <div className="toolbar no-print">
              <div className="seg" role="group" aria-label="View by">
                {VIEWS.map((v) => (
                  <button key={v.key} className={view === v.key ? 'on' : ''} onClick={() => setView(v.key)}>{v.label}</button>
                ))}
              </div>
              <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
                <option value="all">All departments</option>
                {project.departments.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
              </select>
              <button className="btn sm" disabled={idx <= 0} onClick={() => setEntity(entities[idx - 1].id)} aria-label="Previous">‹</button>
              <select value={current || ''} onChange={(e) => setEntity(e.target.value)} aria-label={viewInfo.label} style={{ minWidth: 200 }}>
                {entities.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
              <button className="btn sm" disabled={idx < 0 || idx >= entities.length - 1} onClick={() => setEntity(entities[idx + 1].id)} aria-label="Next">›</button>
              <span className="spacer" />
              <button
                className={`btn sm ${editing ? 'primary' : ''}`}
                disabled={stale}
                title={stale ? 'Regenerate first: the data changed after this timetable was made' : 'Move classes by hand'}
                onClick={() => { setEditing(!editing); setSelected(null); setHover(null); }}
              >
                {editing ? '✓ Done moving' : '✋ Move classes'}
              </button>
              <button className="btn sm" onClick={() => window.print()} disabled={!current}>Print this</button>
              <button className="btn sm" onClick={() => setPrintAll(true)} disabled={!entities.length}>
                Print all {entities.length} {viewInfo.plural}
              </button>
            </div>
            {current ? (
              <>
                <PrintHead project={project} view={viewInfo.label} label={entityLabel} />
                <div className="tt-title no-print">
                  <h3>{entityLabel}</h3>
                  <span className="muted small">{subtitle(project, view, current)}</span>
                </div>
                {editing && (
                  <div className="edit-bar no-print" role="status">
                    {selectedInfo?.pl.locked ? (
                      <div className="edit-line">
                        <span>🔒 <b>{selectedInfo.row.subject}</b> ({selectedInfo.row.section}) is locked, so it stays where it is. Unlock it to move it.</span>
                        <button className="btn sm" onClick={() => setLock([selected], false)}>🔓 Unlock</button>
                      </div>
                    ) : selectedInfo ? (
                      <>
                        <div className="edit-line">
                          <span>
                            <b>Moving {selectedInfo.row.subject}</b> ({selectedInfo.row.section}, {selectedInfo.pl.len} period{selectedInfo.pl.len > 1 ? 's' : ''}).{' '}
                            {selectedInfo.free
                              ? `Click or drop on a green slot (${selectedInfo.free} free). Red slots show why on hover. Esc to cancel.`
                              : 'There is no free slot for it this week. Move another class first.'}
                          </span>
                          <button className="btn sm" onClick={() => { setLock([selected], true); setSelected(null); setHover(null); }}>🔒 Lock where it is</button>
                        </div>
                        <div className="edit-hover">{hover || ' '}</div>
                      </>
                    ) : (
                      <div className="edit-line">
                        <span>Click a class (or drag it) to move or lock it.{!isCoord && ' You can change your own department\'s classes.'}</span>
                        {inView.length > 0 && (
                          <span className="row" style={{ gap: 6 }}>
                            <button className="btn sm" disabled={inView.every((p) => p.locked)} onClick={() => setLock(inView.map((p) => p.uid), true)}>
                              🔒 Lock all {inView.length} here
                            </button>
                            <button className="btn sm" disabled={!inView.some((p) => p.locked)} onClick={() => setLock(inView.map((p) => p.uid), false)}>
                              🔓 Unlock all
                            </button>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <Grid
                  project={project}
                  placements={tt.placements}
                  view={view}
                  id={current}
                  edit={editing ? { selected, options, canMove, onSelect: setSelected, onMove: moveTo, onHover: setHover } : undefined}
                />
                <Legend />
              </>
            ) : (
              <div className="empty-state">Nothing to show for this department.</div>
            )}
          </div>

          <div className="print-only">
            {printAll &&
              entities.map((e) => (
                <div key={e.id} className="print-page">
                  <PrintHead project={project} view={viewInfo.label} label={e.label} />
                  <Grid project={project} placements={tt.placements} view={view} id={e.id} />
                </div>
              ))}
          </div>
        </>
      )}

      {!tt && isCoord && errorCount === 0 && project.load.length > 0 && (
        <div className="card empty-state">
          <p style={{ marginBottom: 12 }}>The data has no errors. Generate the timetable for all {project.sections.length} sections.</p>
          <button className="btn primary big" disabled={busy} onClick={() => run(1)}>
            {busy ? <><span className="spinner" /> Generating…</> : 'Generate timetable'}
          </button>
        </div>
      )}
    </div>
  );
}

function subtitle(project, view, id) {
  if (view === 'section') {
    const s = project.sections.find((x) => x.id === id);
    const hours = project.load.filter((l) => l.section === id).reduce((a, l) => a + (Number(l.hours) || 0), 0);
    return s ? `${s.dept} · Semester ${s.semester} · ${s.students} students · ${hours} hrs/week` : '';
  }
  if (view === 'teacher') {
    const t = project.teachers.find((x) => x.id === id);
    const hours = project.load.filter((l) => l.teacher === id).reduce((a, l) => a + (Number(l.hours) || 0), 0);
    return t ? `${t.dept} · ${hours} of max ${t.maxPerWeek} hrs/week · max ${t.maxPerDay} a day` : '';
  }
  const r = project.rooms.find((x) => x.id === id);
  return r ? `${r.type} · ${r.capacity} seats · ${r.dept === 'shared' ? 'shared by all departments' : `belongs to ${r.dept}`}` : '';
}

function PrintHead({ project, view, label }) {
  return (
    <div className="print-head">
      <h2>{view}: {label}</h2>
      <span className="muted">{project.settings.name}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="legend no-print">
      <span><i style={{ background: 'var(--lunch)' }} /> Lunch / break</span>
      <span><i style={{ background: 'var(--fixed)' }} /> College-wide fixed slot</span>
      <span><i style={{ background: 'repeating-linear-gradient(45deg,#f1f3f6,#f1f3f6 3px,#e2e6ec 3px,#e2e6ec 6px)' }} /> Short day, no classes</span>
      <span><i style={{ background: 'repeating-linear-gradient(45deg,#fff4f4,#fff4f4 3px,#fde5e5 3px,#fde5e5 6px)' }} /> Teacher unavailable</span>
      <span><b style={{ fontSize: 10 }}>LAB</b> Lab block over several periods</span>
    </div>
  );
}

function Unplaced({ project, tt }) {
  const items = useMemo(() => tt.unplaced.map((u) => ({ u, why: explainUnplaced(project, tt.placements, u) })), [project, tt]);
  return (
    <div className="card unplaced no-print">
      <div className="card-pad" style={{ paddingBottom: 6 }}>
        <h3>{tt.unplaced.length} class(es) could not be placed without a clash</h3>
        <p className="muted small">Nothing was forced in. Here is why each one didn't fit, and what would help.</p>
      </div>
      {items.map(({ u, why }) => (
        <div key={u.uid} className="unplaced-item">
          <b>{why.summary}</b>
          {why.reasons.length > 0 && (
            <ul>{why.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          )}
          {why.tips.map((t, i) => <div key={i} className="small" style={{ marginTop: 6 }}>💡 {t}</div>)}
        </div>
      ))}
    </div>
  );
}

// Locked classes the last regenerate couldn't keep because the data changed.
function DroppedLocks({ project, dropped }) {
  return (
    <div className="banner warn no-print">
      <div className="grow">
        <b>{dropped.length} locked class(es) couldn't stay where they were</b>, so they were placed somewhere valid instead:
        <ul style={{ margin: '4px 0 0' }}>
          {dropped.map((d) => {
            const row = project.load.find((l) => l.id === d.loadId);
            return <li key={d.uid}>{row ? `${row.subject} (${row.section})` : 'A removed class'}: {d.reason}.</li>;
          })}
        </ul>
      </div>
    </div>
  );
}
