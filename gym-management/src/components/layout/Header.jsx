import { Menu, PanelLeft } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useState, useEffect } from 'react';
import { shiftService } from '../../services/shiftService';
import { formatDate } from '../../utils/formatters';
import logo from '../../assets/logo-wide.png';

const titleMap = {
  '/dashboard': 'Tổng quan',
  '/members': 'Hội viên',
  '/inventory': 'Bán nước & kho',
  '/shifts': 'Ca trực & bàn giao',
  '/notes': 'Sổ ghi chú',
  '/staff': 'Nhân viên & lương',
  '/logs': 'Nhật ký hoạt động',
  '/statistics': 'Thống kê',
};

const weekdays = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

export default function Header({ onMenuToggle }) {
  const location = useLocation();
  const title = titleMap[location.pathname] || 'Max Power Gym';
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

  const now = new Date();
  const personName = activeStaff ? activeStaff.full_name : (profile?.full_name || 'Đang tải...');

  return (
    <header className="modern-header">
      <div className="mobile-topbar">
        <img src={logo} alt="Max Power Gym" />
        <button type="button" onClick={onMenuToggle} aria-label="Mở menu">
          <Menu size={20} />
        </button>
      </div>

      <div className="desktop-title-row">
        <div className="title-block">
          <button className="desktop-toggle" onClick={onMenuToggle} title="Ẩn/hiện menu" aria-label="Ẩn/hiện menu">
            <PanelLeft size={18} />
          </button>
          <div>
            <p className="page-eyebrow">{weekdays[now.getDay()]} · {formatDate(now)}</p>
            <h2>{title}</h2>
          </div>
        </div>
        <div className="system-status">
          <div>
            <small>{activeStaff ? 'Người trực' : 'Tài khoản'}</small>
            <strong>{personName}</strong>
          </div>
          <div>
            <small>Ca hiện tại</small>
            <strong>
              <span className={`status-dot ${activeShift ? '' : 'off'}`} />
              {activeShift ? activeShift.shift_name : 'Chưa mở ca'}
            </strong>
          </div>
        </div>
      </div>
    </header>
  );
}
