import { ReactNode, useState, useMemo, useCallback } from "react";
import { forwardRef } from "react";
import { Icon, IconName } from "../icons";
import { Button } from "./Button";
import "./Table.css";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  selection?: "none" | "single" | "multiple";
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string, direction: "asc" | "desc") => void;
  loading?: boolean;
  emptyMessage?: string;
  rowClassName?: (row: T) => string;
  striped?: boolean;
  hoverable?: boolean;
  className?: string;
}

function TableHeader<T>({
  columns,
  sortColumn,
  sortDirection,
  onSort,
  selection,
  selectedKeys,
  onSelectionChange,
}: {
  columns: Column<any>[];
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string, direction: "asc" | "desc") => void;
  selection?: "none" | "single" | "multiple";
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
}) {
  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (selection === "multiple") {
      // Would need data to know all keys - handled by parent
    }
  };

  return (
    <thead>
      <tr className="table-header">
        {selection === "multiple" && (
          <th className="table-th table-th-checkbox" style={{ width: "40px" }}>
            <input
              type="checkbox"
              className="table-checkbox"
              aria-label="Select all rows"
            />
          </th>
        )}
        {columns.map((col) => (
          <th
            key={col.key}
            className={`table-th ${col.className || ""} ${col.sortable ? "sortable" : ""} ${col.align ? `align-${col.align}` : ""}`}
            style={{ width: col.width }}
            scope="col"
            onClick={() => col.sortable && onSort?.(col.key, sortColumn === col.key && sortDirection === "asc" ? "desc" : "asc")}
            aria-sort={sortColumn === col.key ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
          >
            <div className="th-content">
              <span>{col.header}</span>
              {col.sortable && sortColumn === col.key && (
                <Icon name={sortDirection === "asc" ? "chevron" : "chevron"} size={12} className={`sort-icon ${sortDirection === "desc" ? "desc" : ""}`} aria-hidden="true" />
              )}
            </div>
          </th>
        ))}
        <th className="table-th table-th-actions" style={{ width: "120px" }}><span className="sr-only">Actions</span></th>
      </tr>
    </thead>
  );
}

function TableBody<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  selection,
  selectedKeys,
  onSelectionChange,
  rowClassName,
  striped,
  hoverable,
}: {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  selection?: "none" | "single" | "multiple";
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  rowClassName?: (row: T) => string;
  striped?: boolean;
  hoverable?: boolean;
}) {
  if (data.length === 0) return null;

  return (
    <tbody>
      {data.map((row, rowIndex) => {
        const rowKey = keyExtractor(row);
        const isSelected = selectedKeys?.has(rowKey);
        return (
          <tr
            key={rowKey}
            className={`table-tr ${isSelected ? "selected" : ""} ${striped && rowIndex % 2 === 1 ? "striped" : ""} ${hoverable ? "hoverable" : ""} ${rowClassName?.(row) || ""}`}
            onClick={() => onRowClick?.(row)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick?.(row); } }}
            tabIndex={onRowClick ? 0 : undefined}
            role={onRowClick ? "button" : undefined}
            aria-selected={isSelected}
          >
            {selection === "multiple" && (
              <td className="table-td table-td-checkbox">
                <input
                  type="checkbox"
                  className="table-checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    const newKeys = new Set(selectedKeys || []);
                    if (e.target.checked) newKeys.add(rowKey); else newKeys.delete(rowKey);
                    onSelectionChange?.(newKeys);
                  }}
                  aria-label={`Select row ${rowKey}`}
                />
              </td>
            )}
            {columns.map((col) => (
              <td key={col.key} className={`table-td ${col.className || ""} ${col.align ? `align-${col.align}` : ""}`}>
                {col.render(row)}
              </td>
            ))}
            <td className="table-td table-td-actions"><span className="sr-only">Actions</span></td>
          </tr>
        );
      })}
    </tbody>
  );
}

export const Table = forwardRef<HTMLTableElement, TableProps<any>>(
  (
    {
      columns,
      data,
      keyExtractor,
      onRowClick,
      selection = "none",
      selectedKeys,
      onSelectionChange,
      sortColumn,
      sortDirection = "asc",
      onSort,
      loading = false,
      emptyMessage = "No data",
      rowClassName,
      striped = true,
      hoverable = true,
      className = "",
    }: TableProps<any>,
    ref
  ) => {
    return (
      <div className={`table-wrapper ${className}`} ref={ref}>
        <div className="table-container" role="region" aria-label="Data table" tabIndex={0}>
          {loading && <div className="table-loading" aria-live="polite" aria-busy="true">Loading…</div>}
          <table className="table" role="grid">
            <TableHeader
              columns={columns}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={onSort}
              selection={selection}
              selectedKeys={selectedKeys}
              onSelectionChange={onSelectionChange}
            />
            <TableBody
              columns={columns}
              data={data}
              keyExtractor={keyExtractor}
              onRowClick={onRowClick}
              selection={selection}
              selectedKeys={selectedKeys}
              onSelectionChange={onSelectionChange}
              rowClassName={rowClassName}
              striped={striped}
              hoverable={hoverable}
            />
          </table>
          {data.length === 0 && !loading && (
            <div className="table-empty" role="status">
              <svg className="table-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M4 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                <path d="M9 13h6M9 17h4" />
              </svg>
              <p>{emptyMessage}</p>
            </div>
          )}
        </div>
      </div>
    );
  }
);

Table.displayName = "Table";

export type { TableProps };