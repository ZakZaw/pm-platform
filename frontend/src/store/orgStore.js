import { create } from 'zustand';
import { orgsApi } from '@/api/orgs.api';

export const useOrgStore = create((set) => ({
  orgs: [],
  loaded: false,

  refresh: async () => {
    const orgs = await orgsApi.mine();
    set({ orgs, loaded: true });
    return orgs;
  },

  reset: () => set({ orgs: [], loaded: false }),
}));
