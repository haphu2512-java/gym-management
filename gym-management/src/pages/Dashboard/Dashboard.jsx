import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    revenue: 0,
    todayShifts: 0,
  });

  useEffect(() => {
    // TODO: Fetch dashboard statistics from Supabase
    loadStats();
  }, []);

  const loadStats = async () => {
    // Placeholder for fetching stats
    setStats({
      totalMembers: 42,
      activeMembers: 38,
      revenue: 15000000,
      todayShifts: 3,
    });
  };

  return (
    <div className="dashboard">
      <h1>Bảng điều khiển</h1>
      <p>Xin chào, {user?.email}</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-label">Tổng học viên</div>
            <div className="stat-value">{stats.totalMembers}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-label">Học viên hoạt động</div>
            <div className="stat-value">{stats.activeMembers}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-label">Doanh thu tháng này</div>
            <div className="stat-value">{stats.revenue.toLocaleString('vi-VN')}₫</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏰</div>
          <div className="stat-content">
            <div className="stat-label">Ca làm hôm nay</div>
            <div className="stat-value">{stats.todayShifts}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
