"use client";

import { useEffect, useRef } from "react";

export default function useProductModalEscape(open: boolean, busy: boolean, onClose: () => void) {
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || busy) return;
      if (document.querySelector("dialog[open]")) return;
      const modals = document.querySelectorAll("[data-product-modal], [data-inventory-modal]");
      if (modals.item(modals.length - 1) !== modalRef.current) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, busy, onClose]);
  return modalRef;
}
