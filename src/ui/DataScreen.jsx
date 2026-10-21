import { useRef, useState } from 'react';
import { TABLES, templateCSV, exportCSV, importCSV } from '../io/csv.js';
import { rowDept, canEdit, renameRefs, downloadFile, readFile } from '../io/project.js';
import EditableTable from './EditableTable.jsx';
import CollegeSettings from './CollegeSettings.jsx';

const TAB_ORDER = ['settings', 'departments', 'rooms', 'teachers', 'sections', 'load'];

export default function DataScreen({ project, role, update, tab, setTab, notify }) {
  return (
    <div>
      <div className="page-head">
        <div>
          <h2>College data</h2>
          <p className="muted">Type directly into the tables, or import a CSV file per table (download a template to see the columns).</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {TAB_ORDER.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'settings' ? 'College & timings' : TABLES[t].label}
            {t !== 'settings' && <span className="count">{project[t].length}</span>}
          </button>
        ))}
      </div>
      {tab === 'settings' ? (
        <CollegeSettings project={project} role={role} update={update} />
      ) : (
        <TableTab key={tab} table={tab} project={project} role={role} update={update} notify={notify} />
      )}
    </div>
  );
}

function newRow(table, project, role) {
  const dept = role === 'coordinator' ? project.departments[0]?.id ?? '' : role;
  switch (table) {
    case 'departments':
      return { id: '', name: '', hod: '' };
    case 'rooms':
      return { id: '', type: 'classroom', capacity: 60, dept: role === 'coordinator' ? 'shared' : role };
    case 'teachers':
      return { id: '', name: '', dept, maxPerWeek: 18, maxPerDay: 4, unavailable: [] };
    case 'sections':
      return { id: '', dept, semester: 1, students: 60 };
    default: {
      const section = project.sections.find((s) => role === 'coordinator' || s.dept === role)?.id ?? '';
      return { id: `L${Date.now() % 1000000}`, section, subject: '', teacher: '', type: 'theory', hours: 3, block: 1, roomType: 'classroom' };
    }
  }
}

function TableTab({ table, project, role, update, notify }) {
  const spec = TABLES[table];
  const isCoord = role === 'coordinator';
  const [deptFilter, setDeptFilter] = useState(isCoord ? 'all' : role);
  const [search, setSearch] = useState('');
  const fileRef = useRef(null);
  const canAdd = isCoord || table !== 'departments';

  const items = project[table]
    .map((row, index) => {
      const dept = rowDept(table, row, project);
      return { row, index, dept, editable: canEdit(role, dept) };
    })
    .filter((it) => table === 'departments' || deptFilter === 'all' || it.dept === deptFilter || (deptFilter === 'shared' && it.dept == null))
    .filter((it) => !search || JSON.stringify(it.row).toLowerCase().includes(search.toLowerCase()));

  // HODs may only move rows into their own department.
  const restrictOptions = isCoord
    ? null
    : (key, options) => {
        if (key === 'dept') return options.filter((o) => o.value === role);
        if (key === 'section') return options.filter((o) => project.sections.find((s) => s.id === o.value)?.dept === role);
        return options;
      };

  const onCell = (index, key, value) =>
    update((p) => {
      const old = p[table][index];
      let next = { ...p, [table]: p[table].map((r, i) => (i === index ? { ...r, [key]: value } : r)) };
      if (key === 'type' && table === 'load') {
        next[table][index].block = value === 'lab' ? 2 : 1;
        if (value === 'theory') next[table][index].roomType = 'classroom';
      }
      if (key === 'id') next = renameRefs(next, table, old.id, value);
      return next;
    });

  const onDelete = (index) => {
    const row = project[table][index];
    const used =
      (table === 'teachers' && project.load.some((l) => l.teacher === row.id)) ||
      (table === 'sections' && project.load.some((l) => l.section === row.id));
    if (used && !confirm(`${row.name || row.id} is used in the teaching load. Delete anyway?`)) return;
    update((p) => ({ ...p, [table]: p[table].filter((_, i) => i !== index) }));
  };

  const onAdd = () => {
    update((p) => ({ ...p, [table]: [...p[table], newRow(table, p, role)] }));
    setSearch('');
  };

  const onImport = async (file) => {
    if (!file) return;
    const { rows, problems } = importCSV(table, await readFile(file), project);
    if (!rows.length) {
      notify(problems[0] || 'Nothing to import.');
      return;
    }
    let keep = [];
    let incoming = rows;
    let skipped = 0;
    if (!isCoord) {
      // An HOD's import replaces only their own department's rows.
      const probe = { ...project, [table]: rows };
      incoming = rows.filter((r) => rowDept(table, r, table === 'load' ? project : probe) === role);
      skipped = rows.length - incoming.length;
      keep = project[table].filter((r) => rowDept(table, r, project) !== role);
    }
    const replacing = project[table].length - keep.length;
    if (replacing > 0 && !confirm(`Replace ${replacing} existing ${spec.label.toLowerCase()} row(s) with ${incoming.length} row(s) from ${file.name}?`)) return;
    update((p) => ({ ...p, [table]: [...keep, ...incoming] }));
    const parts = [`Imported ${incoming.length} row(s) into ${spec.label}.`];
    if (skipped) parts.push(`${skipped} row(s) for other departments were skipped.`);
    if (problems.length) parts.push(`${problems.length} warning(s): ${problems[0]}`);
    notify(parts.join(' '));
  };

  return (
    <div>
      <div className="toolbar">
        {table !== 'departments' && (
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} aria-label="Filter by department">
            <option value="all">All departments</option>
            {project.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.id}</option>
            ))}
            {table === 'rooms' && <option value="shared">Shared rooms</option>}
          </select>
        )}
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search rows" style={{ width: 180 }} />
        <span className="spacer" />
        {canAdd && <button className="btn sm primary" onClick={onAdd}>+ Add row</button>}
        {canAdd && <button className="btn sm" onClick={() => fileRef.current.click()}>Import CSV</button>}
        <button className="btn sm" onClick={() => downloadFile(spec.file.replace('.csv', '_template.csv'), templateCSV(table), 'text/csv')}>
          Download template
        </button>
        <button className="btn sm" onClick={() => downloadFile(spec.file, exportCSV(table, project), 'text/csv')}>Export CSV</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { onImport(e.target.files[0]); e.target.value = ''; }} />
      </div>
      {table === 'load' && (
        <p className="muted small" style={{ marginBottom: 10 }}>
          "Periods together" is how many periods run back to back: 1 for a normal lecture, 2–3 for a lab. A 4-hour subject with 1 period
          together becomes four separate lectures.
        </p>
      )}
      <EditableTable
        columns={spec.columns}
        items={items}
        project={project}
        restrictOptions={restrictOptions}
        onCell={onCell}
        onDelete={onDelete}
        notify={notify}
      />
      <p className="muted small" style={{ marginTop: 8 }}>
        Showing {items.length} of {project[table].length} rows.
        {!isCoord && ' Greyed rows belong to other departments and are read-only.'}
      </p>
    </div>
  );
}
