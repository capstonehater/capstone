"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import styles from './forecasting.module.css';

type Option = { value: string; label: string };

export default function GraphSelect({ label, value, options, onChange, className = '' }: {
  label: string; value: string; options: Option[]; onChange: (value: string) => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  const openMenu = () => {
    setOpen(true);
    requestAnimationFrame(() => items.current[options.findIndex((option) => option.value === value)]?.focus());
  };
  return <div ref={root} className={`${styles.graphSelect} ${className}`} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={(event) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  }}>
    <span id={`${id}-label`} className={styles.graphSelectLabel}>{label}</span>
    <button ref={trigger} type="button" className={styles.graphSelectTrigger} aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-options` : undefined} onClick={() => open ? setOpen(false) : openMenu()} onKeyDown={(event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openMenu(); }
    }}><span id={`${id}-value`}>{selected?.label ?? 'Select'}</span><ChevronDown size={17} aria-hidden="true" /></button>
    {open && <div id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`} className={styles.graphSelectMenu}>
      {options.map((option, index) => <button key={option.value} ref={(node) => { items.current[index] = node; }} type="button" role="option" aria-selected={option.value === value} className={`${styles.graphSelectOption} ${option.value === value ? styles.graphSelectSelected : ''}`} onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus(); }} onKeyDown={(event) => {
        let next = index;
        if (event.key === 'ArrowDown') next = (index + 1) % options.length;
        else if (event.key === 'ArrowUp') next = (index + options.length - 1) % options.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = options.length - 1;
        else return;
        event.preventDefault(); items.current[next]?.focus();
      }}>{option.label}{option.value === value && <Check size={16} aria-hidden="true" />}</button>)}
    </div>}
  </div>;
}
