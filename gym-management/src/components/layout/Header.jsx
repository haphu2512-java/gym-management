import { LayoutDashboard } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useState, useEffect } from 'react';
import { shiftService } from '../../services/shiftService';

const titleMap = {
  '/dashboard': 'Tổng quan hệ thống',
  '/members': 'Danh sách hội viên',
  '/inventory': 'Kho & Bán hàng',
  '/shifts': 'Quản lý ca trực',
  '/staff': 'Nhân viên & tính lương',
};

function formatDate() {
  return new Date().toLocaleDateString('vi-VN');
}

export default function Header({ onMenuToggle }) {
  const location = useLocation();
  const title = titleMap[location.pathname] || 'Gym Management';
  const { profile } = useAuthStore();

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
          <p>Chào buổi sáng! Hôm nay là ngày {formatDate()}</p>
        </div>
        <div className="system-status" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="status-dot" />
            <span>{profile?.full_name || 'Đang tải...'}</span>
          </div>
          <div style={{ borderLeft: '1px solid #ddd', paddingLeft: '12px' }}>
            <span>Ca: {activeShift ? activeShift.shift_name : 'Chưa mở ca'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}



