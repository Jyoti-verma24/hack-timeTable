// Department status board: who has submitted their data, and what to do next.

export default function Overview({ project, role, issues, stale, update, go, goData }) {
  const { departments, sections, teachers, load, rooms, status, timetable } = project;
  const errors = issues.filter((i) => i.level === 'error');
  const totalHours = load.reduce((a, l) => a + (Number(l.hours) || 0), 0);
  const submitted = departments.filter((d) => status[d.id] === 'submitted').length;
  const isCoord = role === 'coordinator';

  const setStatus = (dept, value) => update((p) => ({ ...p, status: { ...p.status, [dept]: value } }));

  let next;
  if (!departments.length) next = { text: 'Start by setting the college timings, then add your departments.', action: () => goData('settings'), label: 'Set up college' };
  else if (!load.length) next = { text: 'Add rooms, teachers, sections and the teaching load (or import them from CSV).', action: () => goData('rooms'), label: 'Add data' };
  else if (errors.length) next = { text: `${errors.length} problem(s) in the data must be fixed before generating.`, action: () => go('check'), label: 'See problems' };
  else if (!timetable) next = { text: 'The data looks good. Generate the timetable for the whole college.', action: () => go('timetable'), label: 'Go to Generate' };
  else if (stale) next = { text: 'The data changed after the timetable was made. Generate again to include the changes.', action: () => go('timetable'), label: 'Regenerate' };
  else next = { text: 'The timetable is ready and verified clash-free.', action: () => go('timetable'), label: 'View timetable' };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>{project.settings.name}</h2>
          <p className="muted">
            {project.settings.days.length} working days · {project.settings.periods.length} periods a day
            {Object.keys(project.settings.halfDays || {}).length > 0 && ` · half-day on ${Object.keys(project.settings.halfDays).join(', ')}`}
          </p>
        </div>
      </div>

      <div className={`banner ${errors.length && load.length ? 'warn' : timetable && !stale ? 'ok' : 'info'}`}>
        <div className="grow">
          <b>Next step: </b>
          {next.text}
        </div>
        <button className="btn sm primary" onClick={next.action}>{next.label}</button>
      </div>

      <div className="stat-row">
        <Stat value={departments.length} label="Departments" />
        <Stat value={sections.length} label="Sections" />
        <Stat value={teachers.length} label="Teachers" />
        <Stat value={`${totalHours}`} label={`Teaching hours / week · ${rooms.length} rooms`} />
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>Departments</h3>
        <span className="muted small">
          {submitted} of {departments.length} departments have submitted their data
        </span>
      </div>

      {departments.length === 0 ? (
        <div className="card empty-state">No departments yet. {isCoord && <button className="btn sm" onClick={() => goData('departments')}>Add departments</button>}</div>
      ) : (
        <div className="dept-grid">
          {departments.map((d) => {
            const deptSections = sections.filter((s) => s.dept === d.id).map((s) => s.id);
            const hours = load.filter((l) => deptSections.includes(l.section)).reduce((a, l) => a + (Number(l.hours) || 0), 0);
            const deptErrors = errors.filter((e) => e.dept === d.id).length;
            const st = status[d.id] || 'draft';
            const mine = role === d.id;
            return (
              <div key={d.id} className={`card dept-card ${mine ? 'mine' : ''}`}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <h3>{d.id}</h3>
                    <div className="muted small">{d.name}</div>
                  </div>
                  <span className={`chip ${st === 'submitted' ? 'ok' : 'neutral'}`}>{st === 'submitted' ? '✓ Submitted' : 'Draft'}</span>
                </div>
                <div className="small">HOD: {d.hod || <span className="muted">not set</span>}</div>
                <div className="counts">
                  <span>{deptSections.length} sections</span>
                  <span>{teachers.filter((t) => t.dept === d.id).length} teachers</span>
                  <span>{hours} hrs/week</span>
                </div>
                {deptErrors > 0 && <span className="chip err">{deptErrors} problem(s) to fix</span>}
                {(mine || isCoord) && (
                  <div className="row">
                    {st !== 'submitted' ? (
                      <button className="btn sm primary" disabled={deptErrors > 0} title={deptErrors ? 'Fix the problems first' : ''} onClick={() => setStatus(d.id, 'submitted')}>
                        Mark as submitted
                      </button>
                    ) : (
                      <button className="btn sm" onClick={() => setStatus(d.id, 'draft')}>Reopen for changes</button>
                    )}
                    {mine && <button className="btn sm ghost" onClick={() => goData('load')}>Edit my data</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="card stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
