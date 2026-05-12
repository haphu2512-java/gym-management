import { LayoutDashboard } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useState, useEffect } from 'react';
import { shiftService } from '../../services/shiftService';
import { formatDate } from '../../utils/formatters';

const titleMap = {
  '/dashboard': 'Tổng quan hệ thống',
  '/members': 'Danh sách hội viên',
  '/inventory': 'Kho & Bán hàng',
  '/shifts': 'Quản lý ca trực',
  '/staff': 'Nhân viên & tính lương',
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Chào buổi sáng!';
  if (hour < 18) return 'Chào buổi chiều!';
  return 'Chào buổi tối!';
}

export default function Header({ onMenuToggle }) {
  const location = useLocation();
  const title = titleMap[location.pathname] || 'Gym Management';
  const { profile, activeStaff } = useAuthStore();

  const [activeShift, setActiveShift] = useState(null);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const { shift } = await shiftService.validateShiftForLogin();
        setActiveShift(shift);
      } catch (err) {
        console.error('Failed to fetch shift info:', err);
      }
    };
    fetchInfo();
  }, [location.pathname]);

  // Tên hiển thị: "Trâm Anh — Ca 3" hoặc tên tài khoản nếu chưa chọn nhân viên
  const displayName = activeStaff
    ? activeShift
      ? `${activeStaff.full_name} — ${activeShift.shift_name}`
      : activeStaff.full_name
    : (profile?.full_name || 'Đang tải...');

  return (
    <header className="modern-header">
      <div className="mobile-topbar">
        <h1>MAX POWER</h1>
        <button type="button" onClick={onMenuToggle}>
          <LayoutDashboard size={18} />
        </button>
      </div>

      <div className="desktop-title-row">
        <div>
          <h2>{title}</h2>
          <p>{getGreeting()} Hôm nay là ngày {formatDate(new Date())}</p>
        </div>
        <div className="system-status" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="status-dot" />
            <span>{displayName}</span>
          </div>
          {!activeStaff && (
            <div style={{ borderLeft: '1px solid #ddd', paddingLeft: '12px' }}>
              <span>Ca: {activeShift ? activeShift.shift_name : 'Chưa mở ca'}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}




