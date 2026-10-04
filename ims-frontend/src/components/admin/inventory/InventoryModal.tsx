"use client";
import { useEffect, useRef } from "react";
import ModalCloseButton from "@/components/ModalCloseButton";
import backdrop from "@/components/ModalBackdrop.module.css";

import styles from "./InventoryModal.module.css";
import motion from "./InventoryModalMotion.module.css";

type InventoryModalProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  bodyClassName?: string;
  professional?: boolean;
};

export default function InventoryModal({
  title,
  description,
  children,
  onClose,
  wide = false,
  bodyClassName,
  professional = false,
}: InventoryModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Native dialogs and open dropdowns handle Escape before the underlying modal.
      if (document.querySelector("dialog[open]")) return;
      const modals = document.querySelectorAll("[data-inventory-modal]");
      if (modals.item(modals.length - 1) !== modalRef.current) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div ref={modalRef} data-inventory-modal className={`${backdrop.backdrop} ${motion.overlay} ${professional ? styles.professional : ""} fixed inset-0 z-[90] flex items-center justify-center p-4`}>
      <div
        className={`${motion.panel} flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[32px] border border-white/40 bg-[#f8f3ec] shadow-[0_28px_90px_rgba(15,23,42,0.28)] ${wide ? "max-w-6xl" : "max-w-3xl"}`}
      >
        <div className={`${styles.header} flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5`}>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>
        <div className={bodyClassName ?? "flex-1 overflow-y-auto p-6"}>{children}</div>
      </div>
    </div>
  );
}
