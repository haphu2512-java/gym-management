import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export default function Header() {
  const { user, logout } = useAuthStore();

  return (
    <header className="header">
      <div className="header-content">
        <h2>Welcome back, {user?.email || 'Guest'}</h2>
        <button onClick={logout} className="btn-logout">
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
