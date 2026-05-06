import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, UserCheck, UserX } from 'lucide-react';
import { memberService } from '../../services/memberService';

function getMemberStatus(endDate) {
  if (!endDate) return 'Expired';
  const today = new Date();
  const target = new Date(endDate);
  return target >= new Date(today.toDateString()) ? 'Active' : 'Expired';
}

export default function Dashboard() {
  const [members, setMembers] = useState([]);
  const [recentMembers, setRecentMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [data, recent] = await Promise.all([
          memberService.getAllMembers(),
          memberService.getRecentMembers(3)
        ]);
        setMembers(data);
        setRecentMembers(recent);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const stats = useMemo(() => {
    const activeCount = members.filter((m) => getMemberStatus(m.end_date) === 'Active').length;
    const expiredCount = members.filter((m) => getMemberStatus(m.end_date) === 'Expired').length;
    const totalRevenue = members.reduce((sum, m) => sum + Number(m.fee || 0), 0);

    return { activeCount, expiredCount, totalRevenue };
  }, [members]);

  return (
    <div className="modern-stack">
      {loading && <div className="modern-info">Đang tải dữ liệu...</div>}

      <div className="modern-grid-3">
        <div className="modern-card stat-card-modern">
          <div className="stat-icon-wrap blue"><UserCheck size={22} /></div>
          <div>
            <p className="stat-label-modern">Hội viên hoạt động</p>
            <p className="stat-value-modern">{stats.activeCount}</p>
          </div>
        </div>

        <div className="modern-card stat-card-modern">
          <div className="stat-icon-wrap red"><UserX size={22} /></div>
          <div>
            <p className="stat-label-modern">Hội viên hết hạn</p>
            <p className="stat-value-modern">{stats.expiredCount}</p>
          </div>
        </div>

        <div className="modern-card stat-card-modern">
          <div className="stat-icon-wrap green"><TrendingUp size={22} /></div>
          <div>
            <p className="stat-label-modern">Doanh thu (dự tính)</p>
            <p className="stat-value-modern">{stats.totalRevenue.toLocaleString('vi-VN')}đ</p>
          </div>
        </div>
      </div>

      <div className="modern-card">
        <h3 className="modern-title">Gia hạn gần đây</h3>
        <div className="modern-list">
          {recentMembers.length === 0 && <p className="muted-text">Chưa có dữ liệu hội viên.</p>}
          {recentMembers.map((m) => (
            <div key={m.id} className="modern-list-item">
              <div className="member-avatar">{(m.full_name || 'U').charAt(0).toUpperCase()}</div>
              <div className="flex-1">
                <p className="member-name">{m.full_name}</p>
                <p className="member-meta">Gói {m.package_type} tháng - {m.payment_method === 'TM' ? 'Tiền mặt' : 'Chuyển khoản'}</p>
              </div>
              <p className="member-fee">+{Number(m.fee || 0).toLocaleString('vi-VN')}đ</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

