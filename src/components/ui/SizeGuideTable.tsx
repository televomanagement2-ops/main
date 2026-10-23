interface Props {
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  notes?: string | null;
}

/**
 * A size guide as the shopper sees it — and as the admin previews it. The
 * first column is the size, so it reads as the row's heading. Cells are plain
 * text: React escapes them, whatever the admin typed.
 */
export function SizeGuideTable({ columns, rows, notes }: Props) {
  return (
    <div className="size-guide">
      <div className="size-guide__scroll">
        <table className="size-guide__table">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i} scope="col">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) =>
                  c === 0 ? (
                    <th key={c} scope="row">{cell}</th>
                  ) : (
                    <td key={c}>{cell}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notes && <p className="size-guide__notes">{notes}</p>}
    </div>
  );
}
