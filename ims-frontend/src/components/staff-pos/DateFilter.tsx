"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import selectStyles from "@/components/admin/AdminSelect.module.css";
import styles from "./DateFilter.module.css";

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type Props = { label: string; value: string; min?: string; max?: string; placement?: "auto" | "above"; onChange: (value: string) => void };

export default function DateFilter({ label, value, min, max, placement = "auto", onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ left: 0, top: 0 });
  const [month, setMonth] = useState(() => new Date());
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const today = dateValue(new Date());
  const allowed = (date: string) => (!min || date >= min) && (!max || date <= max);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent | FocusEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    panel.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]:not(:disabled), button[data-today="true"]:not(:disabled), button[data-day]:not(:disabled)')?.focus();
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    const close = () => setOpen(false);
    const scroll = (event: Event) => { if (!panel.current?.contains(event.target as Node)) close(); };
    window.addEventListener("resize", close);
    document.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [open]);

  function choose(date: string) {
    onChange(date);
    setOpen(false);
    trigger.current?.focus();
  }

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();

  return <div ref={root} className={styles.field} onKeyDown={(event) => {
    if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  }}>
    <span id={`${id}-label`} className={selectStyles.label}>{label}</span>
    <button ref={trigger} type="button" className={selectStyles.trigger} aria-labelledby={`${id}-label ${id}-value`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-calendar` : undefined}
      onClick={() => {
        if (!open) {
          const rect = trigger.current?.getBoundingClientRect();
          if (rect) {
            const fieldTop = root.current?.getBoundingClientRect().top ?? rect.top;
            const above = fieldTop - 20;
            const below = window.innerHeight - rect.bottom - 20;
            const openAbove = placement === "above" || (below < 360 && above > below);
            setPosition({
              left: Math.max(12, Math.min(rect.left, window.innerWidth - 308)),
              ...(openAbove
                ? { bottom: window.innerHeight - fieldTop + 8, maxHeight: Math.max(0, above) }
                : { top: rect.bottom + 8, maxHeight: Math.max(0, below) }),
            });
          }
          const initial = value || (min && today < min ? min : max && today > max ? max : today);
          setMonth(new Date(`${initial}T12:00:00`));
        }
        setOpen(!open);
      }}>
      <span id={`${id}-value`} className={value ? undefined : styles.placeholder}>{value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Select date"}</span>
      <CalendarDays size={18} aria-hidden="true" />
    </button>
    {open && <div ref={panel} id={`${id}-calendar`} role="dialog" aria-labelledby={`${id}-label`} className={styles.calendar} style={position}>
      <div className={styles.header}>
        <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><ChevronLeft size={18} /></button>
        <strong aria-live="polite">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
        <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><ChevronRight size={18} /></button>
      </div>
      <div className={styles.days}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day} className={styles.weekday}>{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const date = new Date(year, monthIndex, index + 1);
          const iso = dateValue(date);
          return <button key={iso} type="button" data-day data-today={iso === today} aria-current={iso === today ? "date" : undefined}
            aria-label={date.toLocaleDateString("en-US", { dateStyle: "full" })} aria-pressed={value === iso}
            disabled={!allowed(iso)} onClick={() => choose(iso)}>{index + 1}</button>;
        })}
      </div>
      <div className={styles.footer}>
        <button type="button" onClick={() => choose("")}>Clear</button>
        <button type="button" disabled={!allowed(today)} onClick={() => choose(today)}>Today</button>
      </div>
    </div>}
  </div>;
}
