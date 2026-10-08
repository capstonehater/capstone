"use client";

import { Children, cloneElement, isValidElement, useContext, useState, type ReactNode, type ReactElement, type CSSProperties } from "react";

import { createPortal } from "react-dom";
import { Columns3, ChevronDown } from "lucide-react";
import { ReportColumnsHeaderContext } from "@/components/dashboard/WidgetCard";
import styles from "./ReportColumns.module.css";

type ElementProps = { children?: ReactNode; className?: string; style?: CSSProperties; colSpan?: number };

/** Independent column visibility for both grid-based and native report tables. */
export default function ReportColumns({ columns, gridTemplate, title, children }: {
  columns: string[];
  gridTemplate?: string;
  title?: string;
  children: ReactNode;
}) {
  const headerTarget = useContext(ReportColumnsHeaderContext);
  const [hidden, setHidden] = useState<number[]>([]);
  const visibleCount = columns.length - hidden.length;
  const tracks = gridTemplate?.split("_");

  function render(node: ReactNode): ReactNode {
    return Children.map(node, child => {
      if (!isValidElement<ElementProps>(child) || typeof child.type !== "string") return child;
      const props = child.props;
      const isGridRow = gridTemplate && props.className?.includes(`grid-cols-[${gridTemplate}]`);
      const isTableRow = child.type === "tr";
      if (isGridRow || isTableRow) {
        let column = 0;
        const cells = Children.map(props.children, cell => {
          if (!isValidElement<ElementProps>(cell)) return cell;
          const span = cell.props.colSpan ?? 1;
          const start = column;
          column += span;
          const remaining = Array.from({ length: span }, (_, offset) => start + offset).filter(index => !hidden.includes(index)).length;
          return cloneElement(cell, {
            ...(span > 1 ? { colSpan: Math.max(1, remaining) } : {}),
            style: { ...cell.props.style, ...(remaining === 0 ? { display: "none" } : {}) },
          });
        });
        return cloneElement(child as ReactElement<ElementProps>, {
          style: { ...props.style, ...(isGridRow ? { gridTemplateColumns: tracks?.filter((_, index) => !hidden.includes(index)).join(" ") } : {}) },
          children: cells,
        });
      }
      return cloneElement(child, { children: render(props.children) });
    });
  }

  const control = <details className={styles.selector}>
    <summary className={styles.trigger}>
      <Columns3 size={16} aria-hidden="true" />
      <span>Columns</span><span className={styles.count}>{visibleCount}/{columns.length}</span>
      <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
    </summary>
    <div className={styles.menu}>
      <fieldset className={styles.options}>
        <legend className={styles.legend}>Choose columns to show</legend>
        {columns.map((label, index) => <label key={index} className={styles.option}>
          <input className={styles.checkbox} type="checkbox" checked={!hidden.includes(index)} disabled={visibleCount === 1 && !hidden.includes(index)} onChange={() => setHidden(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index])} />
          <span>{label}</span>
        </label>)}
      </fieldset>
      <button type="button" className={styles.reset} onClick={() => setHidden([])}>Show all columns</button>
    </div>
  </details>;

  return <div className="min-w-0">
    {title || headerTarget === undefined ? <div className={styles.header}>
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      {control}
    </div> : headerTarget ? createPortal(control, headerTarget) : null}
    {render(children)}
  </div>;
}
