import { useCallback, useEffect } from 'react';
import { authService } from '../services/authService';
import { shiftService } from '../services/shiftService';
import { useAuthStore } from '../store/useAuthStore';

export function useAuth() {
  const {
    user,
    profile,
    assignedShift,
    loading,
    setUser,
    setProfile,
    setAssignedShift,
    setLoading,
  } = useAuthStore();

  const checkUser = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = await authService.getCurrentUser();
      let currentProfile = null;

      if (currentUser?.id) {
        currentProfile = await authService.getProfile(currentUser.id);
      }

      setUser(currentUser);
      setProfile(currentProfile);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setProfile, setUser]);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { user: currentUser } = await authService.login(email, password);
      const currentProfile = await authService.getProfile(currentUser.id);

      if (currentProfile?.role === 'staff') {
        const shiftCheck = await shiftService.validateShiftForLogin();
        if (!shiftCheck.valid) {
          await authService.logout();
          throw new Error('Chưa có ca trực đang mở. Vui lòng liên hệ quản lý để mở ca.');
        }
        setAssignedShift(shiftCheck.shift);
      }

      setUser(currentUser);
      setProfile(currentProfile);
      return currentUser;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setProfile(null);
      setAssignedShift(null);
    } finally {
      setLoading(false);
    }
  };

  return { user, profile, assignedShift, loading, login, logout };
}

