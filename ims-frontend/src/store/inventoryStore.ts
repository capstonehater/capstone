import { create } from "zustand";

type InventoryPanel =
  | null
  | "create-material"
  | "edit-material"
  | "stock-run-create"
  | "stock-run-manage"
  | "waste"
  | "archive-material"
  | "delete-draft";

type InventoryState = {
  search: string;
  statusFilter: string;
  supplierId: string;
  selectedRawMaterialId: string | null;
  activePanel: InventoryPanel;
  historyType: string;
  historyFrom: string;
  historyTo: string;
  historySearch: string;
  setSearch: (search: string) => void;
  setStatusFilter: (statusFilter: string) => void;
  setSupplierId: (supplierId: string) => void;
  setSelectedRawMaterialId: (selectedRawMaterialId: string | null) => void;
  setActivePanel: (activePanel: InventoryPanel) => void;
  setHistoryType: (historyType: string) => void;
  setHistoryFrom: (historyFrom: string) => void;
  setHistoryTo: (historyTo: string) => void;
  setHistorySearch: (historySearch: string) => void;
};

export const useInventoryStore = create<InventoryState>((set) => ({
  search: "",
  statusFilter: "",
  supplierId: "",
  selectedRawMaterialId: null,
  activePanel: null,
  historyType: "",
  historyFrom: "",
  historyTo: "",
  historySearch: "",
  setSearch: (search) => set({ search }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSupplierId: (supplierId) => set({ supplierId }),
  setSelectedRawMaterialId: (selectedRawMaterialId) =>
    set({ selectedRawMaterialId }),
  setActivePanel: (activePanel) => set({ activePanel }),
  setHistoryType: (historyType) => set({ historyType }),
  setHistoryFrom: (historyFrom) => set({ historyFrom }),
  setHistoryTo: (historyTo) => set({ historyTo }),
  setHistorySearch: (historySearch) => set({ historySearch }),
}));
