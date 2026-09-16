"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Layers, Package, ChevronDown } from "lucide-react";
import styles from "./forecasting.module.css";

export default function MaterialDropdown({ value, onChange, products }: { value: string; onChange: (value: string) => void; products: { id: string; name: string }[] }) {
  const options = useMemo(() => [{ value: "", label: "All products", icon: Layers }, ...products.map((product) => ({ value: product.id, label: product.name, icon: Package }))], [products]);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const Icon = selected.icon;

  useEffect(() => {
    if (!open) return;
    items.current[options.findIndex((option) => option.value === value)]?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open, value, options]);

  return (
    <div ref={root} className={`${styles.materialFilter} ${styles.dropdown}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    }}>
      <span id="material-type-label" className={styles.filterLabel}>Product</span>
      <button ref={trigger} type="button" className={styles.dropdownTrigger} aria-labelledby="material-type-label material-type-value" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? "material-menu" : undefined} onClick={() => setOpen(!open)} onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
      }}>
        <Icon size={20} aria-hidden="true" /><span id="material-type-value">{selected.label}</span><ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && <div id="material-menu" role="menu" aria-labelledby="material-type-label" className={styles.dropdownMenu}>
        {options.map((option, index) => {
          const OptionIcon = option.icon;
          return <button key={option.value} ref={(node) => { items.current[index] = node; }} type="button" role="menuitemradio" aria-checked={value === option.value} className={`${styles.dropdownOption} ${value === option.value ? styles.dropdownSelected : ""}`} onClick={() => {
            onChange(option.value); setOpen(false); trigger.current?.focus();
          }} onKeyDown={(event) => {
            let next = index;
            if (event.key === "ArrowDown") next = (index + 1) % options.length;
            else if (event.key === "ArrowUp") next = (index + options.length - 1) % options.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = options.length - 1;
            else return;
            event.preventDefault(); items.current[next]?.focus();
          }}><OptionIcon size={22} aria-hidden="true" /><span>{option.label}</span></button>;
        })}
      </div>}
    </div>
  );
}
