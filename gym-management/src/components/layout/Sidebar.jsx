import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clock, Droplets, LayoutDashboard, LogOut, Users, WalletCards, ScrollText, TrendingUp, BookOpen, MoreVertical } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import logo from '../../assets/logo.png';

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

export default function Sidebar({ isOpen, onClose }) {
  const [showLogout, setShowLogout] = useState(false);
  const location = useLocation();
  const { user, profile, activeStaff, logout } = useAuthStore();

  const baseItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Báo Cáo Chung' },
    { key: 'members', path: '/members', label: 'Quản Lý Hội Viên' },
    { key: 'inventory', path: '/inventory', label: 'Quản Lý Nước' },
    { key: 'shifts', path: '/shifts', label: 'Ca Làm & Bàn Giao' },
    { key: 'notes', path: '/notes', label: 'Sổ Nhật Ký (Ghi Chú)' },
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
        <img src={logo} alt="Max Power Gym" style={{ width: '80px', height: 'auto', marginBottom: '12px', display: 'block', borderRadius: '12px' }} />
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

      <div className="sidebar-footer" style={{ position: 'relative' }}>
        {showLogout && (
          <div style={{ position: 'absolute', bottom: '100%', left: '16px', right: '16px', marginBottom: '8px', background: '#ffffff', borderRadius: '12px', padding: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 50, border: '1px solid #e2e8f0' }}>
            <button type="button" className="logout-btn-modern" onClick={logout} style={{ width: '100%', margin: 0, justifyContent: 'flex-start', background: '#fee2e2', color: '#dc2626' }}>
              <LogOut size={18} /> Đăng xuất hệ thống
            </button>
          </div>
        )}
        <div 
          className="user-box" 
          onClick={() => setShowLogout(!showLogout)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: showLogout ? '#e2e8f0' : 'transparent', borderRadius: '12px', transition: 'background 0.2s', margin: '0 8px' }}
        >
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{activeStaff ? 'Đang trực' : 'Đang đăng nhập'}</p>
            <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {activeStaff
                ? `${activeStaff.full_name}`
                : `${profile?.full_name || 'User'}`
              }
            </strong>
          </div>
          <MoreVertical size={16} color="#64748b" style={{ flexShrink: 0 }} />
        </div>
      </div>
    </aside>
  );
}

