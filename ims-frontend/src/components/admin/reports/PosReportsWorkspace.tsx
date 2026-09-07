"use client";

import { useMemo, useState } from "react";
import {
  getPresetDateRange,
  getPresetLabel,
  toManilaRangeIso,
  type QuickDatePreset,
} from "@/lib/report-date-range";
import PosDashboardSection from "./PosDashboardSection";
import PosPaymentReportsSection from "./PosPaymentReportsSection";
import PosPeakHoursSection from "./PosPeakHoursSection";
import PosProductPerformanceSection from "./PosProductPerformanceSection";
import PosRefundsVoidsSection from "./PosRefundsVoidsSection";
import PosSalesAnalyticsSection from "./PosSalesAnalyticsSection";
import PosTransactionHistorySection from "./PosTransactionHistorySection";

type SectionKey =
  | "dashboard"
  | "transactions"
  | "sales-analytics"
  | "payment-reports"
  | "refunds-voids"
  | "product-performance"
  | "peak-hours";

const SECTION_OPTIONS: Array<{
  value: SectionKey;
  label: string;
  description: string;
}> = [
  {
    value: "dashboard",
    label: "Dashboard",
    description: "Daily KPIs, sales trend, and the most recent POS orders.",
  },
  {
    value: "transactions",
    label: "Transaction History",
    description: "Searchable, paginated transaction history with receipt-level drill-down.",
  },
  {
    value: "sales-analytics",
    label: "Sales Analytics",
    description: "Grouped sales, discounts, refunds, and previous-period comparisons.",
  },
  {
    value: "payment-reports",
    label: "Payment Reports",
    description: "Payment method breakdowns, e-wallet totals, and split-payment visibility.",
  },
  {
    value: "refunds-voids",
    label: "Refunds & Voids",
    description: "Reversal summaries, reasons, responsible staff, and approval context.",
  },
  {
    value: "product-performance",
    label: "Product Performance",
    description: "Top sellers, slow movers, contribution mix, and current-category product views.",
  },
  {
    value: "peak-hours",
    label: "Peak Hours",
    description: "Hourly sales, busiest periods, and weekday-versus-weekend timing patterns.",
  },
];

function getRefreshLabel(section: SectionKey) {
  switch (section) {
    case "transactions":
      return "History";
    case "sales-analytics":
      return "Analytics";
    case "payment-reports":
      return "Payments";
    case "refunds-voids":
      return "Refunds & Voids";
    case "product-performance":
      return "Product Performance";
    case "peak-hours":
      return "Peak Hours";
    default:
      return "Dashboard";
  }
}

export default function PosReportsWorkspace() {
  const initialPreset = getPresetDateRange("today");
  const [activeSection, setActiveSection] = useState<SectionKey>("dashboard");
  const [preset, setPreset] = useState<QuickDatePreset>("today");
  const [from, setFrom] = useState(initialPreset.from);
  const [to, setTo] = useState(initialPreset.to);
  const [refreshToken, setRefreshToken] = useState(0);

  const manilaRange = useMemo(() => toManilaRangeIso({ from, to }), [from, to]);

  const handlePresetChange = (
    nextPreset: Exclude<QuickDatePreset, "custom">,
  ) => {
    const range = getPresetDateRange(nextPreset);
    setPreset(nextPreset);
    setFrom(range.from);
    setTo(range.to);
  };

  const handleFromChange = (value: string) => {
    setPreset("custom");
    setFrom(value);
  };

  const handleToChange = (value: string) => {
    setPreset("custom");
    setTo(value);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">POS Reports</h2>
            <p className="mt-2 max-w-3xl text-neutral-600">
              Backend-authoritative POS reporting over sales, payments, reversals, transaction
              history, product mix, and peak-hour demand using Asia/Manila business-day
              boundaries.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">From</span>
              <input
                type="date"
                value={from}
                onChange={(event) => handleFromChange(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">To</span>
              <input
                type="date"
                value={to}
                onChange={(event) => handleToChange(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              {(["today", "yesterday", "this-week"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handlePresetChange(option)}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    preset === option
                      ? "bg-[#f45a1f] text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {getPresetLabel(option)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRefreshToken((current) => current + 1)}
              className="rounded-2xl bg-[#f45a1f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#d94f1a]"
            >
              Refresh {getRefreshLabel(activeSection)}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Active range: <span className="font-semibold text-slate-900">{getPresetLabel(preset)}</span>{" "}
          | {from} to {to} | queries sent as Asia/Manila business-day ISO boundaries.
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SECTION_OPTIONS.map((option) => {
          const active = activeSection === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setActiveSection(option.value)}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                active
                  ? "border-[#f45a1f] bg-[#fff3ed] text-[#8b2f10]"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="text-sm font-semibold">{option.label}</div>
              <p className="mt-1 text-xs leading-5 text-inherit/80">{option.description}</p>
            </button>
          );
        })}
      </section>

      <PosDashboardSection
        active={activeSection === "dashboard"}
        fromIso={manilaRange.from}
        toIso={manilaRange.to}
        preset={preset}
        refreshToken={refreshToken}
      />

      <PosTransactionHistorySection
        active={activeSection === "transactions"}
        from={from}
        to={to}
        fromIso={manilaRange.from}
        toIso={manilaRange.to}
        refreshToken={refreshToken}
      />

      <PosSalesAnalyticsSection
        active={activeSection === "sales-analytics"}
        from={from}
        to={to}
        fromIso={manilaRange.from}
        toIso={manilaRange.to}
        refreshToken={refreshToken}
      />

      <PosPaymentReportsSection
        active={activeSection === "payment-reports"}
        from={from}
        to={to}
        fromIso={manilaRange.from}
        toIso={manilaRange.to}
        refreshToken={refreshToken}
      />

      <PosRefundsVoidsSection
        active={activeSection === "refunds-voids"}
        from={from}
        to={to}
        fromIso={manilaRange.from}
        toIso={manilaRange.to}
        refreshToken={refreshToken}
      />

      <PosProductPerformanceSection
        active={activeSection === "product-performance"}
        from={from}
        to={to}
        fromIso={manilaRange.from}
        toIso={manilaRange.to}
        refreshToken={refreshToken}
      />

      <PosPeakHoursSection
        active={activeSection === "peak-hours"}
        from={from}
        to={to}
        fromIso={manilaRange.from}
        toIso={manilaRange.to}
        refreshToken={refreshToken}
      />
    </div>
  );
}
