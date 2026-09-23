"use client";

import PosReportEmpty from "./PosReportEmpty";

import { useEffect, useState } from "react";
import SummaryCard from "./PosReportMetric";
import WidgetCard from "@/components/dashboard/WidgetCard";
import {
  exportPosRefundsVoidsCsv,
  exportPosRefundsVoidsPdf,
} from "@/lib/report-exports";
import {
  fetchPosRefundsVoids,
  type PosRefundsVoidsReport,
} from "@/lib/reports";
import { formatDateTime, formatPeso } from "@/lib/pos-utils";

type Props = {
  active: boolean;
  from: string;
  to: string;
  fromIso: string;
  toIso: string;
  refreshToken: number;
};

function reversalTone(type: "REFUND" | "VOID") {
  return type === "REFUND"
    ? "bg-amber-100 text-amber-700"
    : "bg-rose-100 text-rose-700";
}

export default function PosRefundsVoidsSection({
  active,
  from,
  to,
  fromIso,
  toIso,
  refreshToken,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PosRefundsVoidsReport | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [exportingFormat, setExportingFormat] = useState<"csv" | "pdf" | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    try {
      const nextReport = await fetchPosRefundsVoids({
        from: fromIso,
        to: toIso,
        staffSearch: staffSearch.trim() || undefined,
      });
      setReport(nextReport);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to load refunds and voids report",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) {
      return;
    }

    void loadReport();
  }, [active, fromIso, toIso, staffSearch, refreshToken]);

  if (!active) {
    return null;
  }

  const handleExport = async (format: "csv" | "pdf") => {
    if (!report) {
      return;
    }

    setExportingFormat(format);
    setExportNotice(null);
    setExportError(null);

    try {
      const snapshot = {
        filters: {
          from,
          to,
          staffSearch: staffSearch.trim() || undefined,
        },
        report,
      };

      if (format === "csv") {
        const filename = exportPosRefundsVoidsCsv(snapshot);
        setExportNotice(`CSV export downloaded as ${filename}.`);
      } else {
        const filename = exportPosRefundsVoidsPdf(snapshot);
        setExportNotice(
          `Printable refunds and voids report opened as ${filename}. Use your browser's Save as PDF option to finish the export.`,
        );
      }
    } catch (nextError) {
      setExportError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to export refunds and voids report",
      );
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {exportError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {exportError}
        </div>
      ) : null}

      {exportNotice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {exportNotice}
        </div>
      ) : null}

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">Refunds</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Review refunds and their recorded reasons. Responsible staff is
              the original order creator, while reversal actor and approval context remain visible
              separately.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Responsible Staff</span>
              <input
                value={staffSearch}
                onChange={(event) => setStaffSearch(event.target.value)}
                placeholder="Filter by order creator name or email"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              />
            </label>
            <button
              type="button"
              disabled={loading || exportingFormat !== null}
              onClick={() => void handleExport("csv")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
            </button>
            <button
              type="button"
              disabled={loading || exportingFormat !== null}
              onClick={() => void handleExport("pdf")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingFormat === "pdf" ? "Preparing..." : "Export PDF"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Refund Count"
          value={loading ? "..." : report?.summary.refundCount ?? 0}
        />
        <SummaryCard
          title="Refunded Amount"
          value={loading ? "..." : formatPeso(report?.summary.refundedAmount ?? "0")}
        />
        <SummaryCard
          title="Total Reversals"
          value={loading ? "..." : report?.summary.totalReversalCount ?? 0}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <WidgetCard title="Reasons">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[0.8fr_1.3fr_0.8fr_0.9fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Type</span>
              <span>Reason</span>
              <span>Count</span>
              <span>Amount</span>
            </div>
            <div className="max-h-[24rem] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-sm text-slate-500">
                  Loading reversal reasons...
                </div>
              ) : (report?.byReason ?? []).length === 0 ? (
                <PosReportEmpty message="No refund or void reasons matched the current filters." />
              ) : (
                report?.byReason.map((row) => (
                  <div
                    key={`${row.type}-${row.reasonCode}`}
                    className="grid grid-cols-[0.8fr_1.3fr_0.8fr_0.9fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                  >
                    <div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${reversalTone(row.type)}`}
                      >
                        {row.type}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-900">{row.reasonCode}</div>
                    <div>{row.count}</div>
                    <div>{formatPeso(row.amount)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </WidgetCard>

        <WidgetCard title="Responsible Staff">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_1fr_1fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Staff</span>
              <span>Reversals</span>
              <span>Refunds</span>
              <span>Voids</span>
              <span>Refunded</span>
              <span>Voided</span>
            </div>
            <div className="max-h-[24rem] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-sm text-slate-500">
                  Loading staff reversal activity...
                </div>
              ) : (report?.byStaff ?? []).length === 0 ? (
                <PosReportEmpty message="No reversal actors matched the current filters." />
              ) : (
                report?.byStaff.map((row) => (
                  <div
                    key={row.responsibleStaff.id}
                    className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_1fr_1fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {row.responsibleStaff.firstName} {row.responsibleStaff.lastName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.responsibleStaff.email}
                      </div>
                    </div>
                    <div>{row.reversalCount}</div>
                    <div>{row.refundCount}</div>
                    <div>{row.voidCount}</div>
                    <div>{formatPeso(row.refundedAmount)}</div>
                    <div>{formatPeso(row.voidedAmount)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </WidgetCard>
      </section>

      <WidgetCard title="Reversal Events">
        <div className="overflow-x-auto">
          <div className="min-w-[88rem] overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1fr_0.8fr_1fr_1fr_1fr_0.9fr_1fr_1fr_1fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Order</span>
              <span>Type</span>
              <span>Occurred At</span>
              <span>Responsible Staff</span>
              <span>Reversal Actor</span>
              <span>Reason</span>
              <span>Requested By</span>
              <span>Approved By</span>
              <span>Amount</span>
            </div>
            <div className="max-h-[32rem] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-sm text-slate-500">
                  Loading reversal events...
                </div>
              ) : (report?.reversals ?? []).length === 0 ? (
                <PosReportEmpty message="No refund or void events matched the current filters." />
              ) : (
                report?.reversals.map((reversal) => (
                  <div
                    key={reversal.id}
                    className="grid grid-cols-[1fr_0.8fr_1fr_1fr_1fr_0.9fr_1fr_1fr_1fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{reversal.orderId}</div>
                      <div className="mt-1 text-xs text-slate-500">{reversal.orderStatus}</div>
                    </div>
                    <div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${reversalTone(reversal.type)}`}
                      >
                        {reversal.type}
                      </span>
                    </div>
                    <div>{formatDateTime(reversal.occurredAt)}</div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {reversal.responsibleStaff.firstName} {reversal.responsibleStaff.lastName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {reversal.responsibleStaff.email}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {reversal.reversalActor.firstName} {reversal.reversalActor.lastName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {reversal.reversalActor.email}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{reversal.reasonCode}</div>
                      {reversal.note ? (
                        <div className="mt-1 text-xs text-slate-500">{reversal.note}</div>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-600">
                      {reversal.approvalContext.requestedBy
                        ? `${reversal.approvalContext.requestedBy.firstName} ${reversal.approvalContext.requestedBy.lastName}`
                        : reversal.approvalContext.requestedByUserId ?? "N/A"}
                    </div>
                    <div className="text-xs text-slate-600">
                      {reversal.approvalContext.approvedByEmail ?? "N/A"}
                    </div>
                    <div className="font-semibold text-slate-900">
                      {formatPeso(reversal.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </WidgetCard>
    </div>
  );
}
