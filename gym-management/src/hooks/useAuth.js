import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../services/authService';
import { shiftService } from '../services/shiftService';

export function useAuth() {
  const { user, profile, assignedShift, loading, setUser, setProfile, setAssignedShift, setLoading } = useAuthStore();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    setLoading(true);
    const currentUser = await authService.getCurrentUser();
    let currentProfile = null;
    if (currentUser?.id) {
      currentProfile = await authService.getProfile(currentUser.id);
    }
    setUser(currentUser);
    setProfile(currentProfile);
    setLoading(false);
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { user } = await authService.login(email, password);
      const currentProfile = await authService.getProfile(user.id);

      if (currentProfile?.role === 'staff') {
        const shiftCheck = await shiftService.validateShiftForLogin();
        if (!shiftCheck.valid) {
          await authService.logout();
          throw new Error('Bạn chưa có ca làm hợp lệ ở thời điểm hiện tại.');
        }
        setAssignedShift(shiftCheck.shift);
      }

      setUser(user);
      setProfile(currentProfile);
      return user;
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
