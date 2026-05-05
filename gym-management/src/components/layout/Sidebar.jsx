import { Link, useLocation } from 'react-router-dom';
import { Clock, Droplets, LayoutDashboard, LogOut, Users, WalletCards } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const icons = {
  dashboard: LayoutDashboard,
  members: Users,
  inventory: Droplets,
  shifts: Clock,
  staff: WalletCards,
};

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user, profile, logout } = useAuthStore();

  const baseItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Báo Cáo Chung' },
    { key: 'members', path: '/members', label: 'Quản Lý Hội Viên' },
    { key: 'inventory', path: '/inventory', label: 'Quản Lý Nước' },
    { key: 'shifts', path: '/shifts', label: 'Ca Làm & Bàn Giao' },
  ];

  const menuItems = profile?.role === 'admin'
    ? [...baseItems, { key: 'staff', path: '/staff', label: 'Nhân Viên & Lương' }]
    : baseItems.filter((item) => item.key !== 'dashboard');

  return (
    <aside className={`modern-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <h1>MAX POWER GYM</h1>
        <p>Management System</p>
      </div>

      <nav className="sidebar-nav-modern">
        {menuItems.map((item) => {
          const Icon = icons[item.key];
          const active = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`side-nav-item ${active ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-box">
          <p>Đang đăng nhập</p>
          <strong>{profile?.role || 'staff'} - {profile?.full_name || user?.email || 'User'}</strong>
        </div>
        <button type="button" className="logout-btn-modern" onClick={logout}>
          <LogOut size={18} /> Đăng xuất
        </button>
      </div>
    </aside>
  );
}

