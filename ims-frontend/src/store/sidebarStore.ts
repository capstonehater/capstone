import { create } from "zustand";

type SidebarState = {
  openSections: Record<string, boolean>;
  materialsOpen: boolean;
  toggleMaterials: () => void;
  collapsed: boolean;
  scrollTop: number;
  toggleSection: (href: string) => void;
  expandSection: (href: string) => void;
  toggleCollapsed: () => void;
  setScrollTop: (scrollTop: number) => void;
};

// Keep sidebar preferences across page component remounts during navigation.
export const useSidebarStore = create<SidebarState>((set) => ({
  openSections: {},
  materialsOpen: false,
  toggleMaterials: () => set(state => ({ materialsOpen: !state.materialsOpen })),
  collapsed: false,
  scrollTop: 0,
  expandSection: (href) => set(state => ({ openSections: { ...state.openSections, [href]: true }, collapsed: false })),
  toggleSection: (href) => set(state => ({
    openSections: { ...state.openSections, [href]: state.collapsed || !state.openSections[href] },
    collapsed: false,
  })),
  toggleCollapsed: () => set(state => ({ collapsed: !state.collapsed })),
  setScrollTop: (scrollTop) => set({ scrollTop }),
}));
