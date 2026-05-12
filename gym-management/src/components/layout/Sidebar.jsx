import { Link, useLocation } from 'react-router-dom';
import { Clock, Droplets, LayoutDashboard, LogOut, Users, WalletCards, ScrollText, TrendingUp } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const icons = {
  dashboard: LayoutDashboard,
  members: Users,
  inventory: Droplets,
  shifts: Clock,
  staff: WalletCards,
  logs: ScrollText,
  statistics: TrendingUp,
};

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user, profile, activeStaff, logout } = useAuthStore();

  const baseItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Báo Cáo Chung' },
    { key: 'members', path: '/members', label: 'Quản Lý Hội Viên' },
    { key: 'inventory', path: '/inventory', label: 'Quản Lý Nước' },
    { key: 'shifts', path: '/shifts', label: 'Ca Làm & Bàn Giao' },
  ];

  const menuItems = profile?.role === 'admin'
    ? [
        ...baseItems, 
        { key: 'statistics', path: '/statistics', label: 'Thống Kê Chi Tiết' },
        { key: 'staff', path: '/staff', label: 'Nhân Viên & Lương' },
        { key: 'logs', path: '/logs', label: 'Nhật Ký Hoạt Động' }
      ]
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
              onClick={() => {
                if (window.innerWidth < 768) onClose();
              }}
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
          <p>{activeStaff ? 'Đang trực' : 'Đang đăng nhập'}</p>
          <strong>
            {activeStaff 
              ? `${activeStaff.full_name} — ${activeStaff.staff_type === 'CT' ? 'Chính thức' : 'Thử việc'}`
              : `${profile?.role === 'admin' ? 'Quản trị' : 'Nhân viên'} — ${profile?.full_name || 'User'}`
            }
          </strong>
        </div>
        <button type="button" className="logout-btn-modern" onClick={logout}>
          <LogOut size={18} /> Đăng xuất
        </button>
      </div>
    </aside>
  );
}

