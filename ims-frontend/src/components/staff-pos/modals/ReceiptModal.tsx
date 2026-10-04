"use client";
import { PermissionAction } from "@/components/auth/PermissionGuard";
import { useState } from "react";
import { buildReceiptHtml, openReceipt } from "@/lib/receipt";
import type { PosOrder } from "@/lib/pos";
import Modal from "./Modal";

type Props = {
  receipt: PosOrder;
  onRefund?: (order: PosOrder) => void;
  reversalSubmitting?: boolean;
  onClose: () => void;
};

export default function ReceiptModal({
  receipt,
  onRefund,
  reversalSubmitting = false,
  onClose,
}: Props) {
  const [printError, setPrintError] = useState("");
  function handlePrint() {
    setPrintError("");
    try { openReceipt(receipt); }
    catch (error) { setPrintError(error instanceof Error ? error.message : "Unable to open receipt."); }
  }
  return (
    <Modal title="Receipt" onClose={onClose}>
      <div>
        <iframe
          title={`Receipt ${receipt.displayOrderNumber}`}
          srcDoc={buildReceiptHtml(receipt).replace('<body>', '<body class="preview">')}
          sandbox=""
          className="h-[55vh] w-full rounded-xl border border-slate-200 bg-[#fffdf7]"
        />
        <p className="mt-3 text-xs text-slate-500">Open the HTML receipt to print, save as PDF, or download. No connected printer is required.</p>
        {printError && <p role="alert" className="mt-2 text-sm text-red-700">{printError}</p>}

        <div className="mt-5 flex justify-end gap-2">
          {receipt.status === "COMPLETED" ? (
            <>

              <PermissionAction permission={"pos.refund"}><button
                type="button"
                disabled={reversalSubmitting || !onRefund}
                onClick={() => onRefund?.(receipt)}
                className="rounded-2xl border border-[#cbd5e1] px-4 py-2 text-sm font-medium text-[#34445f] hover:bg-[#edf2f8] disabled:opacity-60"
              >
                Refund Order
              </button></PermissionAction>
            </>
          ) : null}
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium"
          >
            Print Receipt
          </button>
          <button
            onClick={onClose}
            type="button"
            className="rounded-2xl bg-[#232d46] px-4 py-2 text-sm font-medium text-white hover:bg-[#34445f]"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
