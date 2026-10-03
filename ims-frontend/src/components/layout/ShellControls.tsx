"use client";

import { ChevronLeft, Menu, X } from "lucide-react";
import styles from "./ApplicationShell.module.css";

export function NavigationOverlay({ open, onClose, tabIndex }: {
  open: boolean; onClose: () => void; tabIndex?: number;
}) {
  return open ? <button type="button" className={styles.overlay} aria-label="Close navigation" onClick={onClose} tabIndex={tabIndex} /> : null;
}

export function NavigationCloseButton({ onClose }: { onClose: () => void }) {
  return <button type="button" className={styles.mobileClose} onClick={onClose} aria-label="Close navigation"><X size={20} /></button>;
}

export function NavigationMenuButton({ onOpen, className = styles.shellMobileMenu, expanded, controls }: {
  onOpen: () => void; className?: string; expanded?: boolean; controls?: string;
}) {
  return <button type="button" className={className} onClick={onOpen} aria-expanded={expanded} aria-controls={controls} aria-label="Open navigation"><Menu size={20} /></button>;
}

export function SidebarCollapseButton({ collapsed, onToggle, className }: {
  collapsed: boolean; onToggle: () => void; className: string;
}) {
  return <button type="button" className={className} onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}</button>;
}
