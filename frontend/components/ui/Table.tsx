import {
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Card } from "./Card";
import { TableRowAction } from "./TableRowAction";
import styles from "./Table.module.css";

type Align = "left" | "right";

/**
 * Shared table primitive. CSS-grid layout, columns set via the
 * `columns` prop (a grid-template-columns string). Wraps in a Card by
 * default; pass `bare` for surfaces that own their own border (e.g. the
 * Reports section header).
 *
 *   <Table columns="48px minmax(220px, 1fr) 100px 90px">
 *     <Table.Header>
 *       <Table.HeaderCell />
 *       <Table.HeaderCell>Item</Table.HeaderCell>
 *       <Table.HeaderCell>Confidence</Table.HeaderCell>
 *       <Table.HeaderCell align="right">When</Table.HeaderCell>
 *     </Table.Header>
 *     <Table.Body>{rows.map(...)}</Table.Body>
 *   </Table>
 */
type TableProps = {
  columns: string;
  minWidth?: number;
  scroll?: boolean;
  bare?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children">;

function TableRoot({
  columns,
  minWidth,
  scroll,
  bare,
  className = "",
  children,
  ...rest
}: TableProps) {
  const style = {
    "--table-cols": columns,
    ...(minWidth ? { minWidth: `${minWidth}px` } : null),
  } as CSSProperties;

  const inner = (
    <div className={`${styles.table} ${className}`} style={style} {...rest}>
      {children}
    </div>
  );

  const wrapped = scroll ? <div className={styles.scroll}>{inner}</div> : inner;

  return bare ? wrapped : <Card>{wrapped}</Card>;
}

function TableHeader({
  children,
  className = "",
  ...rest
}: { children: ReactNode; className?: string } & Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "children"
>) {
  return (
    <div role="row" className={`${styles.head} ${className}`} {...rest}>
      {children}
    </div>
  );
}

function TableHeaderCell({
  children,
  align = "left",
  sorted,
  className = "",
  ...rest
}: {
  children?: ReactNode;
  align?: Align;
  sorted?: boolean;
  className?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "className" | "children">) {
  const classes = [
    styles.headCell,
    align === "right" && styles.alignRight,
    sorted && styles.sorted,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span role="columnheader" className={classes} {...rest}>
      {children}
    </span>
  );
}

function TableBody({ children }: { children: ReactNode }) {
  // Fragment so <body> doesn't break grid alignment between rows.
  return <>{children}</>;
}

const TableRow = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    selected?: boolean;
    interactive?: boolean;
    onClick?: (e: MouseEvent<HTMLDivElement>) => void;
    className?: string;
  } & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children" | "onClick">
>(function TableRow(
  { children, selected, interactive, onClick, className = "", ...rest },
  ref,
) {
  const isInteractive = interactive ?? Boolean(onClick);
  const classes = [
    styles.row,
    isInteractive && styles.interactive,
    selected && styles.selected,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      ref={ref}
      role="row"
      className={classes}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
});

function TableCell({
  children,
  align = "left",
  mono,
  muted,
  className = "",
  ...rest
}: {
  children?: ReactNode;
  align?: Align;
  mono?: boolean;
  muted?: boolean;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  const classes = [
    styles.cell,
    align === "right" && styles.alignRight,
    mono && styles.mono,
    muted && styles.muted,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div role="cell" className={classes} {...rest}>
      {children}
    </div>
  );
}

function TableCellTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${styles.cellTitle} ${className}`}>{children}</div>;
}

function TableCellMeta({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${styles.cellMeta} ${className}`}>{children}</div>;
}

function TableFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${styles.footer} ${className}`}>{children}</div>;
}

function TableEmpty({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${styles.empty} ${className}`}>{children}</div>;
}

// Compose the dot-namespace API on the root.
type TableType = typeof TableRoot & {
  Header: typeof TableHeader;
  HeaderCell: typeof TableHeaderCell;
  Body: typeof TableBody;
  Row: typeof TableRow;
  Cell: typeof TableCell;
  CellTitle: typeof TableCellTitle;
  CellMeta: typeof TableCellMeta;
  RowAction: typeof TableRowAction;
  Footer: typeof TableFooter;
  Empty: typeof TableEmpty;
};

export const Table = TableRoot as TableType;
Table.Header = TableHeader;
Table.HeaderCell = TableHeaderCell;
Table.Body = TableBody;
Table.Row = TableRow;
Table.Cell = TableCell;
Table.CellTitle = TableCellTitle;
Table.CellMeta = TableCellMeta;
Table.RowAction = TableRowAction;
Table.Footer = TableFooter;
Table.Empty = TableEmpty;
