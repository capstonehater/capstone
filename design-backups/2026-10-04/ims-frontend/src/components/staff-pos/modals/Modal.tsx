import ModalCloseButton from "@/components/ModalCloseButton";
import { ArrowLeft } from "lucide-react";
import backdrop from "@/components/ModalBackdrop.module.css";
type ModalProps = {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  footer?: React.ReactNode;
  bodyClassName?: string;
  panelClassName?: string;
  showCloseButton?: boolean;
  closeButtonStyle?: "close" | "back";
};

export default function Modal({
  title,
  children,
  onClose,
  wide = false,
  footer,
  bodyClassName = "",
  panelClassName = "",
  showCloseButton = true,
  closeButtonStyle = "close",
}: ModalProps) {
  return (
    <div className={`${backdrop.backdrop} fixed inset-0 z-[90] flex items-center justify-center p-4`}>
      <div
        className={`w-full ${
          wide ? "max-w-5xl" : "max-w-2xl"
        } flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ${panelClassName}`}
      >
        <div className="bg-[var(--modal-header-background)] flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="flex-1 text-lg font-semibold text-slate-900">{title}</h2>
          {showCloseButton && closeButtonStyle === "back" && (
            <button type="button" onClick={onClose} aria-label="Back to products" title="Back to products" className="ml-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition-colors duration-150 hover:border-slate-400 hover:bg-slate-200 hover:text-slate-900 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600">
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
          )}
          {showCloseButton && closeButtonStyle === "close" && <ModalCloseButton onClose={onClose} />}
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto p-6 ${bodyClassName}`}>{children}</div>
        {footer}
      </div>
    </div>
  );
}
