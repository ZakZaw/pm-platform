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

      theme: 'light',
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (value) => set({ theme: value === 'dark' ? 'dark' : 'light' }),

      quickCreateOpen: false,
      openQuickCreate: () => set({ quickCreateOpen: true }),
      closeQuickCreate: () => set({ quickCreateOpen: false }),
    }),
    {
      name: 'pm-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        lastOrgSlug: state.lastOrgSlug,
        theme: state.theme,
      }),
    },
  ),
);
