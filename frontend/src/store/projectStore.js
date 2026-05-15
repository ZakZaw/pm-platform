import { create } from 'zustand';
import { projectsApi } from '@/api/projects.api';

/**
 * Caches the per-org project list and the currently-loaded project detail.
 * Routes set the current project (and slug) through `setCurrent`; consumers
 * read `current` and `byOrg[orgSlug]` from selectors.
 */
export const useProjectStore = create((set, get) => ({
  byOrg: {},
  loadedByOrg: {},
  current: null,

  refreshForOrg: async (orgSlug) => {
    const list = await projectsApi.listForOrg(orgSlug);
    set((s) => ({
      byOrg: { ...s.byOrg, [orgSlug]: list },
      loadedByOrg: { ...s.loadedByOrg, [orgSlug]: true },
    }));
    return list;
  },

  loadCurrent: async (orgSlug, projectSlug) => {
    const project = await projectsApi.getBySlug(orgSlug, projectSlug);
    set({ current: project });
    return project;
  },

  setCurrent: (project) => set({ current: project }),
  clearCurrent: () => set({ current: null }),

  isLoaded: (orgSlug) => Boolean(get().loadedByOrg[orgSlug]),
}));
