import { create } from "zustand";

type SidebarState = {
  openSections: Record<string, boolean>;
  materialsOpen: boolean;
  toggleMaterials: () => void;
  collapsed: boolean;
  scrollTop: number;
  toggleSection: (href: string) => void;
  expandSection: (href: string) => void;
  closeSections: () => void;
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
  expandSection: (href) => set({ openSections: { [href]: true }, collapsed: false }),
  toggleSection: (href) => set(state => ({
    openSections: { [href]: state.collapsed || !state.openSections[href] },
    collapsed: false,
  })),
  closeSections: () => set({ openSections: {}, materialsOpen: false }),
  toggleCollapsed: () => set(state => ({ collapsed: !state.collapsed })),
  setScrollTop: (scrollTop) => set({ scrollTop }),
}));
