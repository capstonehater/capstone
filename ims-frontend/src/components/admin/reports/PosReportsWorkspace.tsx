"use client";

import { useMemo, useRef, useState } from "react";
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

import { ShoppingCart, RefreshCw, Info, ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./PosReports.module.css";

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
    label: "Refunds",
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
      return "Refunds";
    case "product-performance":
      return "Product Performance";
    case "peak-hours":
      return "Peak Hours";
    default:
      return "Dashboard";
  }
}

export default function PosReportsWorkspace() {
  const navigation = useRef<HTMLDivElement>(null);
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
    <div className={styles.workspace}>
      <header className={styles.banner}>
        <ShoppingCart size={44} strokeWidth={1.7} aria-hidden="true" />
        <div><h1>POS Reports</h1><p>Daily sales, transaction history, and point-of-sale performance.</p></div>
      </header>
      <section className={styles.datePanel} aria-label="Report date range">
        <div className={styles.dateControls}>
          <strong>Date Range</strong>
          <label>from <input type="date" aria-label="From date" value={from} max={to} onChange={(event) => handleFromChange(event.target.value)} /></label>
          <label>to <input type="date" aria-label="To date" value={to} min={from} onChange={(event) => handleToChange(event.target.value)} /></label>
          <div className={styles.presets}>
            {(["today", "yesterday", "this-week"] as const).map((option) => (
              <button key={option} type="button" aria-pressed={preset === option} onClick={() => handlePresetChange(option)}>{getPresetLabel(option)}</button>
            ))}
          </div>
        </div>
        <button type="button" className={styles.refresh} onClick={() => setRefreshToken((current) => current + 1)}><RefreshCw size={16} />Refresh {getRefreshLabel(activeSection)}</button>
        <p className={styles.range}><Info size={14} />Active range: {getPresetLabel(preset)} <span>|</span> {from} to {to} <span>|</span> Manila time</p>
      </section>
      <nav className={styles.navigation} aria-label="POS report sections">
        <button type="button" className={styles.navArrow} aria-label="Previous report sections" onClick={() => navigation.current?.scrollBy({left: -navigation.current.clientWidth, behavior: "smooth"})}><ChevronLeft size={20} /></button>
        <div ref={navigation} className={styles.navTrack}>
          {SECTION_OPTIONS.map((option) => (
            <button key={option.value} type="button" aria-current={activeSection === option.value ? "page" : undefined} onClick={() => setActiveSection(option.value)}>
              <strong>{option.label}</strong><span>{option.description}</span>
            </button>
          ))}
        </div>
        <button type="button" className={styles.navArrow} aria-label="More report sections" onClick={() => navigation.current?.scrollBy({left: navigation.current.clientWidth, behavior: "smooth"})}><ChevronRight size={20} /></button>
      </nav>
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
