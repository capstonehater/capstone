"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import styles from "./AdminSelect.module.css";

type Props = {
  searchable?: boolean;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  hideLabel?: boolean;
  name?: string;
  required?: boolean;
  describedBy?: string;
};

export default function AdminSelect({ label, value, options, onChange, disabled = false, id: triggerId, hideLabel = false, name, required = false, describedBy, searchable = false }: Props) {
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const filteredOptions = options.filter(option => !query.trim() || option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!position) return;
    if (searchable) searchInput.current?.focus();
    else items.current[Math.max(0, options.findIndex((option) => option.value === value))]?.focus();
    const dismiss = (event: PointerEvent | FocusEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setPosition(null);
    };
    const close = () => setPosition(null);
    const scroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [position, options, value, searchable]);

  function openMenu() {
    if (disabled || trigger.current?.matches(":disabled")) return;
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    setQuery("");
    setPortalTarget(trigger.current?.closest("dialog") ?? document.body);
    const width = Math.min(Math.max(rect.width, 260), window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 18;
    const above = rect.top - 18;
    const upwards = below < 220 && above > below;
    setPosition({
      width,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      ...(upwards ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      maxHeight: Math.min(300, Math.max(80, upwards ? above : below)),
    });
  }

  return <div ref={root} className={styles.select}>
    <span id={`${id}-label`} className={hideLabel ? styles.hiddenLabel : styles.label}>{label}{required ? <span className="text-red-600" aria-hidden="true"> *</span> : null}</span>
    {required || name ? <select className={styles.validationSelect} aria-hidden="true" tabIndex={-1} value={value} name={name} required={required} disabled={disabled} onChange={event => onChange(event.target.value)} onInvalid={() => trigger.current?.focus()}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select> : null}
    <button ref={trigger} id={triggerId} disabled={disabled} aria-describedby={describedBy} type="button" className={styles.trigger}
      aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={!!position}
      aria-controls={position ? `${id}-options` : undefined}
      onClick={() => position ? setPosition(null) : openMenu()}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); openMenu(); }
      }}>
      <span id={`${id}-value`} title={selected?.label}>{selected?.label ?? "Select"}</span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
    {position && createPortal(<div ref={menu} role="presentation"
      aria-labelledby={`${id}-label`} className={styles.menu} style={position}>
      {searchable ? <div className={styles.searchBar}><input ref={searchInput} className={styles.searchInput} value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}...`} aria-label={`Search ${label.toLowerCase()}`} aria-controls={`${id}-options`} onKeyDown={event => {
        if (event.key === "ArrowDown" && filteredOptions.length) { event.preventDefault(); items.current[0]?.focus(); }
        if (event.key === "Escape") { event.preventDefault(); setPosition(null); trigger.current?.focus(); }
        if (event.key === "Tab") setPosition(null);
      }} /></div> : null}
      <div id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`}>
      {filteredOptions.map((option, index) => <button key={option.value} ref={(node) => { items.current[index] = node; }}
        type="button" role="option" aria-selected={option.value === value} tabIndex={-1}
        className={`${styles.option} ${option.value === value ? styles.selected : ""}`}
        onClick={() => { onChange(option.value); setPosition(null); trigger.current?.focus(); }}
        onKeyDown={(event) => {
          if (event.key === "Escape" || event.key === "Tab") {
            if (event.key === "Escape") event.preventDefault();
            setPosition(null); trigger.current?.focus();
            return;
          }
          let next = index;
          if (event.key === "ArrowDown") next = (index + 1) % filteredOptions.length;
          else if (event.key === "ArrowUp") next = (index + filteredOptions.length - 1) % filteredOptions.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = filteredOptions.length - 1;
          else return;
          event.preventDefault(); items.current[next]?.focus();
        }}>
        <span>{option.label}</span>{option.value === value && <Check size={16} aria-hidden="true" />}
      </button>)}
      </div>
      {filteredOptions.length === 0 ? <p className={styles.empty} role="status">No matching options found.</p> : null}
    </div>, portalTarget ?? document.body)}
  </div>;
}
