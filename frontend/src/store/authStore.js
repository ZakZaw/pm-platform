import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, rawRefresh } from '@/api/auth.api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      isAuthenticated: () => Boolean(get().accessToken && get().user),

      register: async ({ email, password, fullName }) => {
        const data = await authApi.register({ email, password, fullName });
        set({
          user: { id: data.userId, email: data.email, fullName: data.fullName },
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
      },

      login: async ({ email, password }) => {
        const data = await authApi.login({ email, password });
        set({
          user: { id: data.userId, email: data.email, fullName: data.fullName },
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
      },

      refresh: async () => {
        const { refreshToken } = get();
        if (!refreshToken) throw new Error('No refresh token');
        const data = await rawRefresh(refreshToken);
        set({
          user: { id: data.userId, email: data.email, fullName: data.fullName },
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
      },

      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'pm-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
