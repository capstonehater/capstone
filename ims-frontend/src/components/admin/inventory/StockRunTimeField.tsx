"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Clock3 } from "lucide-react";
import styles from "./StockRunTimeField.module.css";

type Props = { id: string; label: string; value: string; required?: boolean; onChange: (value: string) => void };

export default function StockRunTimeField({ id, label, value, required = false, onChange }: Props) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("00:00");
  const [position, setPosition] = useState<CSSProperties>({});
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hour = Number(draft.slice(0, 2));
  const minute = Number(draft.slice(3, 5));
  const displayHour = hour % 12 || 12;
  const period = hour >= 12 ? "PM" : "AM";
  const display = value ? `${String(Number(value.slice(0, 2)) % 12 || 12).padStart(2, "0")}:${value.slice(3, 5)} ${Number(value.slice(0, 2)) >= 12 ? "PM" : "AM"}` : "Select time";
  const update = (nextHour: number, nextMinute: number, nextPeriod: string) => {
    const hour24 = nextHour % 12 + (nextPeriod === "PM" ? 12 : 0);
    setDraft(`${String(hour24).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`);
  };
  const close = () => { setOpen(false); trigger.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent | FocusEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const reposition = () => setOpen(false);
    const scroll = (event: Event) => { if (!panel.current?.contains(event.target as Node)) setOpen(false); };
    panel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    panel.current?.querySelectorAll<HTMLElement>("[data-time-column]").forEach(column => {
      const selected = column.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (selected) column.scrollTop = selected.offsetTop - column.offsetTop - column.clientHeight / 2 + selected.offsetHeight / 2;
    });
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  function openPicker() {
    if (open) { close(); return; }
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(300, window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 20;
    const above = rect.top - 20;
    const upwards = below < 330 && above > below;
    setPosition({ width, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      ...(upwards ? { bottom: window.innerHeight - rect.top + 8, maxHeight: Math.max(80, above) } : { top: rect.bottom + 8, maxHeight: Math.max(80, below) }) });
    setTarget(trigger.current?.closest("dialog") ?? document.body);
    setDraft(/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value) ? value : "00:00");
    setOpen(true);
  }

  return <div className={styles.field}>
    <label id={uid + "-label"} htmlFor={id}>{label}{required && <span className={styles.required} aria-hidden="true"> *</span>}</label>
    <input className={styles.validation} type="time" value={value} required={required} tabIndex={-1} aria-hidden="true" onChange={event => onChange(event.target.value)} onInvalid={openPicker} />
    <button ref={trigger} id={id} type="button" className={styles.trigger} onClick={openPicker}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? uid + "-picker" : undefined} aria-labelledby={uid + "-label " + uid + "-value"}>
      <span id={uid + "-value"}>{display}</span><span className={styles.icon}><Clock3 size={18} aria-hidden="true" /></span>
    </button>
    {open && target && createPortal(<div ref={panel} id={uid + "-picker"} role="dialog" aria-labelledby={uid + "-title"} className={styles.picker} style={position}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
        if (event.key === "Tab") {
          const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button");
          const first = buttons?.[0]; const last = buttons?.[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <header><strong id={uid + "-title"}>Select received time</strong><span>{String(displayHour).padStart(2, "0")}:{String(minute).padStart(2, "0")} {period}</span></header>
      <div className={styles.columnLabels}><span>Hour</span><span>Minute</span><span>Period</span></div>
      <div className={styles.columns}>
        <div data-time-column role="group" aria-label="Hour">{Array.from({ length: 12 }, (_, index) => index + 1).map(h => <button key={h} type="button" aria-pressed={h === displayHour} onClick={() => update(h, minute, period)}>{String(h).padStart(2, "0")}</button>)}</div>
        <div data-time-column role="group" aria-label="Minute">{Array.from({ length: 60 }, (_, m) => <button key={m} type="button" aria-pressed={m === minute} onClick={() => update(displayHour, m, period)}>{String(m).padStart(2, "0")}</button>)}</div>
        <div data-time-column role="group" aria-label="AM or PM">{["AM", "PM"].map(p => <button key={p} type="button" aria-pressed={p === period} onClick={() => update(displayHour, minute, p)}>{p}</button>)}</div>
      </div>
      <footer><button type="button" onClick={close}>Cancel</button><button type="button" onClick={() => { onChange(draft); close(); }}>Apply</button></footer>
    </div>, target)}
  </div>;
}
