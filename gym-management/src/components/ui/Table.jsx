export default function Table({ columns, data, loading = false, actions }) {
  if (loading) {
    return <div className="table-empty-cell" style={{ padding: 16 }}>Dang tai du lieu...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="table-empty-cell" style={{ padding: 16 }}>Khong co du lieu</div>;
  }

  return (
    <div className="modern-table-wrap">
      <table className="modern-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
            {actions && <th>Hanh dong</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id || row.shift_name || JSON.stringify(row)}>
              {columns.map((col) => (
                <td key={col.key}>{col.render ? col.render(row[col.key], row) : row[col.key]}</td>
              ))}
              {actions && <td>{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
