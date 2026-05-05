import { create } from 'zustand';
import { authService } from '../services/authService';

export const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  assignedShift: null,
  loading: true,
  error: null,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setAssignedShift: (assignedShift) => set({ assignedShift }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  initializeAuth: async () => {
    set({ loading: true });
    try {
      const user = await authService.getCurrentUser();
      let profile = null;
      if (user?.id) {
        profile = await authService.getProfile(user.id);
      }
      set({ user, profile, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  logout: async () => {
    try {
      await authService.logout();
      set({ user: null, profile: null, assignedShift: null });
    } catch (error) {
      set({ error: error.message });
    }
  },
}));
