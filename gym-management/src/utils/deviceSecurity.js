const TRUSTED_DEVICE_KEY = 'gym_trusted_device_token';
// Ưu tiên lấy từ biến môi trường VITE_MASTER_SECRET, nếu không có thì dùng mặc định
const MASTER_SECRET = import.meta.env.VITE_MASTER_SECRET;

export const deviceSecurity = {
  /**
   * Kiểm tra thiết bị hiện tại có được tin cậy không
   */
  isDeviceTrusted() {
    const token = localStorage.getItem(TRUSTED_DEVICE_KEY);
    return token === btoa(MASTER_SECRET); // Mã hóa cơ bản để tránh nhìn thấy trực tiếp trong localStorage
  },

  /**
   * Kích hoạt thiết bị này trở thành thiết bị tin cậy
   */
  trustThisDevice(secret) {
    if (secret === MASTER_SECRET) {
      localStorage.setItem(TRUSTED_DEVICE_KEY, btoa(MASTER_SECRET));
      return true;
    }
    return false;
  },

  /**
   * Hủy tin cậy thiết bị
   */
  untrustDevice() {
    localStorage.removeItem(TRUSTED_DEVICE_KEY);
  }
};
