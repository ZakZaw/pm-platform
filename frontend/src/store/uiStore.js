import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUiStore = create(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: Boolean(value) }),

      lastOrgSlug: null,
      setLastOrgSlug: (slug) => set({ lastOrgSlug: slug || null }),
    }),
    {
      name: 'pm-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        lastOrgSlug: state.lastOrgSlug,
      }),
    },
  ),
);
