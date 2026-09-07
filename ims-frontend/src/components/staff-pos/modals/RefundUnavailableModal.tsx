import { ShieldAlert } from "lucide-react";
import Modal from "./Modal";

type Props = {
  onClose: () => void;
};

export default function RefundUnavailableModal({ onClose }: Props) {
  return (
    <Modal title="Refund Authorization Unavailable" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
          Refund authorization is temporarily unavailable because secure
          backend approval has not been connected yet.
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Refunds must be authorized by a real authenticated user and enforced
          on the backend. Frontend-only manager credentials have been disabled
          to prevent bypass.
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#3d3434] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <ShieldAlert className="h-4 w-4" />
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
