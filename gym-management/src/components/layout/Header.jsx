import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export default function Header() {
  const { user, profile, assignedShift, logout } = useAuthStore();

  return (
    <header className="header">
      <div className="header-content">
        <h2>
          Xin chào, {user?.email || 'Guest'} ({profile?.role || 'unknown'})
          {assignedShift?.id ? ` | Ca: ${assignedShift.start_time}-${assignedShift.end_time}` : ''}
        </h2>
        <button onClick={logout} className="btn-logout">
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
