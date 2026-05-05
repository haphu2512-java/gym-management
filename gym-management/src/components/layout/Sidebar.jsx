import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

export default function Sidebar() {
  const location = useLocation();
  const { profile } = useAuthStore();

  const baseItems = [
    { path: '/members', label: 'Quản lý hội viên', icon: '👥' },
    { path: '/inventory', label: 'Kho nước & Bán hàng', icon: '📦' },
    { path: '/shifts', label: 'Quản lý ca làm', icon: '⏰' },
  ];

  const adminItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/staff', label: 'Nhân viên & Lương', icon: '🧾' },
  ];

  const menuItems = profile?.role === 'staff' ? baseItems : [...adminItems, ...baseItems];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>💪 GymMax Power Center</h1>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
