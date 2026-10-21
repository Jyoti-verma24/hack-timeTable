// Generic spreadsheet-like table. Text cells commit on blur/Enter so typing stays smooth.

import { formatSlots, parseSlots } from '../io/slots.js';

export default function EditableTable({ columns, items, project, restrictOptions, onCell, onDelete, notify }) {
  if (!items.length) return <div className="empty-state">No rows here yet.</div>;
  const days = project.settings.days;

  const cell = (col, row, index, editable) => {
    const value = row[col.key];
    if (!editable) {
      let text = value;
      if (col.kind === 'slots') text = formatSlots(value, days);
      if (col.key === 'teacher') text = project.teachers.find((t) => t.id === value)?.name || value;
      return <span className="readonly-cell">{text === '' || text == null ? '—' : String(text)}</span>;
    }
    if (col.kind === 'select') {
      let options = col.options(project).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
      options = restrictOptions ? restrictOptions(col.key, options) : options;
      const known = options.some((o) => o.value === value);
      return (
        <select value={value ?? ''} onChange={(e) => onCell(index, col.key, e.target.value)} aria-label={col.label}>
          {!known && <option value={value ?? ''}>{value ? `${value} (not found)` : 'Choose…'}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }
    const display = col.kind === 'slots' ? formatSlots(value, days) : value ?? '';
    const commit = (e) => {
      const text = e.target.value;
      if (col.kind === 'slots') {
        const { slots, errors } = parseSlots(text, days);
        if (errors.length) notify?.(`Couldn't read "${errors.join(', ')}". Use a form like "Fri 5-8; Mon 1".`);
        if (formatSlots(slots, days) !== display) onCell(index, col.key, slots);
        else e.target.value = display;
      } else if (col.kind === 'number') {
        const n = text === '' ? '' : Number(text);
        if (n !== value) onCell(index, col.key, n);
      } else if (text.trim() !== value) onCell(index, col.key, text.trim());
    };
    return (
      <input
        key={`${index}-${col.key}-${display}`}
        type={col.kind === 'number' ? 'number' : 'text'}
        min={col.kind === 'number' ? 0 : undefined}
        defaultValue={display}
        aria-label={col.label}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    );
  };

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ minWidth: c.width }}>{c.label}</th>
            ))}
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {items.map(({ row, index, editable }) => (
            <tr key={index} className={editable ? '' : 'locked'} title={editable ? '' : 'Read-only: this row belongs to another department'}>
              {columns.map((c) => (
                <td key={c.key}>{cell(c, row, index, editable)}</td>
              ))}
              <td>
                {editable && (
                  <button className="btn ghost sm danger" aria-label="Delete row" title="Delete row" onClick={() => onDelete(index)}>
                    ✕
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
