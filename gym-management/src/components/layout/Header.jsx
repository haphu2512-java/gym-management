import { LayoutDashboard } from 'lucide-react';
import { useLocation } from 'react-router-dom';

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
        <div className="system-status">
          <span className="status-dot" />
          <span>Hệ thống: Sẵn sàng</span>
        </div>
      </div>
    </header>
  );
}

