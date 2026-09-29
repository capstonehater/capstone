import ModalCloseButton from "@/components/ModalCloseButton";
type ModalProps = {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
};

export default function Modal({
  title,
  children,
  onClose,
  wide = false,
}: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={`w-full ${
          wide ? "max-w-5xl" : "max-w-2xl"
        } flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl`}
      >
        <div className="bg-[var(--modal-header-background)] flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <ModalCloseButton onClose={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
