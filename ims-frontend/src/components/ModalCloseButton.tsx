import { X } from "lucide-react";
import styles from "./ModalCloseButton.module.css";

export default function ModalCloseButton({ onClose, autoFocus = false }: {
  onClose: () => void;
  autoFocus?: boolean;
}) {
  return (
    <button type="button" onClick={onClose} autoFocus={autoFocus}
      aria-label="Close dialog" title="Close" className={styles.button}>
      <X size={20} aria-hidden="true" />
    </button>
  );
}
