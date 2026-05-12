import { create } from 'zustand';
import { authService } from '../services/authService';

// Khôi phục activeStaff từ localStorage khi khởi động
const savedStaff = (() => {
  try {
    const raw = localStorage.getItem('gym_active_staff');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
})();

export const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  assignedShift: null,
  loading: true,
  error: null,

  // Nhân viên đang trực ca (chọn từ dropdown, không phải tài khoản đăng nhập)
  activeStaff: savedStaff,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setAssignedShift: (assignedShift) => set({ assignedShift }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  setActiveStaff: (staff) => {
    if (staff) {
      localStorage.setItem('gym_active_staff', JSON.stringify(staff));
    } else {
      localStorage.removeItem('gym_active_staff');
    }
    set({ activeStaff: staff });
  },

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

  login: async (email, password) => {
    set({ loading: true });
    try {
      const user = await authService.login(email, password);
      let profile = null;
      if (user?.id) {
        profile = await authService.getProfile(user.id);
      }
      set({ user, profile, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
      localStorage.removeItem('gym_active_staff');
      set({ user: null, profile: null, assignedShift: null, activeStaff: null });
    } catch (error) {
      set({ error: error.message });
    }
  },
}));
