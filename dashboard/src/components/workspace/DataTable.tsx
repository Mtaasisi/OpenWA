import type { ReactNode } from 'react';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  empty?: ReactNode;
  getRowKey?: (row: T) => string;
  rowKey?: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowDomIdPrefix?: string;
  highlightRowKey?: string | null;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  empty,
  getRowKey,
  rowKey,
  emptyMessage,
  onRowClick,
  rowDomIdPrefix,
  highlightRowKey,
  className = '',
}: DataTableProps<T>) {
  const resolveKey = getRowKey ?? rowKey;
  if (!resolveKey) {
    throw new Error('DataTable requires getRowKey or rowKey');
  }

  if (rows.length === 0) {
    if (empty) return <>{empty}</>;
    if (emptyMessage) {
      return <p className="ws-empty-state__description" style={{ padding: '1rem 0' }}>{emptyMessage}</p>;
    }
  }

  return (
    <div className={`ws-data-table-wrap ${className}`.trim()}>
      <table className="ws-data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} className={col.className}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const key = resolveKey(row);
            const isActive = highlightRowKey != null && highlightRowKey === key;
            return (
              <tr
                key={key}
                id={rowDomIdPrefix ? `${rowDomIdPrefix}-${key}` : undefined}
                className={isActive ? 'ws-data-table__row--active' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map(col => (
                  <td key={col.key} className={col.className}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
