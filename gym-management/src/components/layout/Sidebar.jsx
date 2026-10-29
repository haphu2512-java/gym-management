import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clock, Droplets, LayoutDashboard, LogOut, Users, WalletCards, ScrollText, TrendingUp, BookOpen, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import logo from '../../assets/logo-wide.png';

const icons = {
  dashboard: LayoutDashboard,
  members: Users,
  inventory: Droplets,
  shifts: Clock,
  notes: BookOpen,
  staff: WalletCards,
  logs: ScrollText,
  statistics: TrendingUp,
};

function NavItem({ item, active, onNavigate }) {
  const Icon = icons[item.key];
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      className={`side-nav-item ${active ? 'active' : ''}`}
    >
      <Icon size={18} />
      <span>{item.label}</span>
    </Link>
  );
}

export default function Sidebar({ isOpen, onClose }) {
  const [showLogout, setShowLogout] = useState(false);
  const location = useLocation();
  const { profile, activeStaff, logout } = useAuthStore();

  const baseItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Tổng quan' },
    { key: 'members', path: '/members', label: 'Hội viên' },
    { key: 'inventory', path: '/inventory', label: 'Bán nước & kho' },
    { key: 'shifts', path: '/shifts', label: 'Ca trực & bàn giao' },
    { key: 'notes', path: '/notes', label: 'Sổ ghi chú' },
  ];

  const adminItems = [
    { key: 'statistics', path: '/statistics', label: 'Thống kê' },
    { key: 'staff', path: '/staff', label: 'Nhân viên & lương' },
    { key: 'logs', path: '/logs', label: 'Nhật ký hoạt động' },
  ];

  const isAdmin = profile?.role === 'admin';
  const dailyItems = isAdmin ? baseItems : baseItems.filter((item) => item.key !== 'dashboard');

  const handleNavigate = () => {
    if (window.innerWidth < 768) onClose();
  };

  const displayName = activeStaff ? activeStaff.full_name : (profile?.full_name || 'User');

  return (
    <aside className={`modern-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <img src={logo} alt="Max Power Gym Center" />
        <p>Quầy lễ tân</p>
      </div>

      <nav className="sidebar-nav-modern">
        <div className="sidebar-section-label">Hằng ngày</div>
        {dailyItems.map((item) => (
          <NavItem key={item.path} item={item} active={location.pathname === item.path} onNavigate={handleNavigate} />
        ))}

        {isAdmin && (
          <>
            <div className="sidebar-section-label">Quản lý</div>
            {adminItems.map((item) => (
              <NavItem key={item.path} item={item} active={location.pathname === item.path} onNavigate={handleNavigate} />
            ))}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        {showLogout && (
          <div className="user-menu">
            <button type="button" className="logout-btn-modern" onClick={logout}>
              <LogOut size={18} /> Đăng xuất
            </button>
          </div>
        )}
        <button
          type="button"
          className={`user-box ${showLogout ? 'open' : ''}`}
          onClick={() => setShowLogout(!showLogout)}
        >
          <span className="user-initial">{displayName.trim().split(/\s+/).pop()?.charAt(0).toUpperCase()}</span>
          <span className="user-meta">
            <p>{activeStaff ? 'Đang trực' : 'Đang đăng nhập'}</p>
            <strong>{displayName}</strong>
          </span>
          <ChevronUp size={16} color="#a3a3a8" style={{ flexShrink: 0, transform: showLogout ? 'none' : 'rotate(180deg)' }} />
        </button>
      </div>
    </aside>
  );
}
