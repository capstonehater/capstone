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
        } rounded-3xl bg-white shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            type="button"
            className="rounded-xl px-3 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}