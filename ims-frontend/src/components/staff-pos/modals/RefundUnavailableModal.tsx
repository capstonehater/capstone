import ModalCloseButton from "@/components/ModalCloseButton";

import Modal from "./Modal";

type Props = {
  onClose: () => void;
};

export default function RefundUnavailableModal({ onClose }: Props) {
  return (
    <Modal title="Refund Authorization Unavailable" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-[#edf2f8] p-4 text-sm text-[#232d46]">
          Refund authorization is temporarily unavailable because secure
          backend approval has not been connected yet.
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Refunds must be authorized by a real authenticated user and enforced
          on the backend. Frontend-only manager credentials have been disabled
          to prevent bypass.
        </div>

        <div className="flex justify-end">
          <ModalCloseButton onClose={onClose} />
        </div>
      </div>
    </Modal>
  );
}
