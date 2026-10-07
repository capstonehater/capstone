"use client";

import InventoryReportModal from "./InventoryReportModal";
import styles from "./BatchTransactionModal.module.css";
import type { InventoryTransaction, StockBatch } from "@/lib/inventory";

type BatchTransactionModalProps = {
  batch: StockBatch | null;
  transactions: InventoryTransaction[];
  loading: boolean;
  onClose: () => void;
  formatMoney: (value: string) => string;
  formatQuantity: (value: string) => string;
  formatDate: (value: string | null | undefined) => string;
  formatDateTime: (value: string | null | undefined) => string;
};

export default function BatchTransactionModal({
  batch,
  transactions,
  loading,
  onClose,
  formatMoney,
  formatQuantity,
  formatDate,
  formatDateTime,
}: BatchTransactionModalProps) {
  if (!batch) return null;

  return (
    <InventoryReportModal
      title={`Batch ${(batch.reference ?? batch.id.slice(0, 8))} Drill-Down`}
      description="Review every stock movement tied to this batch, including quantity delta, cost delta, actor, and source."
      onClose={onClose}
    >
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>
            Remaining
          </div>
          <div className={styles.summaryValue}>
            {formatQuantity(batch.remainingQuantity)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>
            Cost Per Unit
          </div>
          <div className={styles.summaryValue}>
            {formatMoney(batch.costPerUnit)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>
            Expiry
          </div>
          <div className={styles.summaryValue}>
            {formatDate(batch.expirationDate)}
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>
            Supplier
          </div>
          <div className={styles.summaryValue}>
            {batch.supplier?.name ?? "N/A"}
          </div>
        </div>
      </div>

      <div className={styles.tableFrame}>
        <div className={styles.tableScroll} aria-busy={loading}>
          <table aria-label="Batch stock movements">
            <thead>
              <tr><th>Occurred</th><th>Type</th><th>Reason</th><th className="text-right">Delta</th><th className="text-right">Cost</th><th>Actor</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className={styles.empty}>Loading batch transactions...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={6} className={styles.empty}>No transactions were found for this batch.</td></tr>
              ) : transactions.map((transaction) => {
                const line = transaction.lines.find((candidate) => candidate.stockBatchId === batch.id);
                const actor = transaction.actorUser
                  ? `${transaction.actorUser.firstName} ${transaction.actorUser.lastName}`
                  : "System";
                const delta = Number(line?.quantityDelta ?? 0);
                return <tr key={transaction.id}>
                  <td>{formatDateTime(transaction.occurredAt)}</td>
                  <td><strong>{transaction.type}</strong><div className={styles.secondary}>{transaction.sourceType}</div></td>
                  <td className={styles.reason}><strong>{transaction.reasonCode || "N/A"}</strong><div className={styles.secondary}>{transaction.note || "No note"}</div></td>
                  <td className={`text-right ${delta >= 0 ? styles.increase : styles.decrease}`}>{delta >= 0 ? "+" : ""}{formatQuantity(line?.quantityDelta ?? "0")}</td>
                  <td className="text-right">{formatMoney(line?.totalCostDelta ?? "0")}</td>
                  <td>{actor}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </InventoryReportModal>
  );
}
