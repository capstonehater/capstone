import { apiJsonFetch } from "./api";
import { useAuthStore } from "@/store/authStore";

export async function authorizeReportExport(format: "excel" | "pdf") {
  if (!useAuthStore.getState().canAll(["reports.view", `reports.export.${format}`])) {
    throw new Error(`Your role does not have permission to export ${format === "excel" ? "Excel" : "PDF"} files.`);
  }
  await apiJsonFetch(`/reports/export-access/${format}`, { cache: "no-store" });
}
