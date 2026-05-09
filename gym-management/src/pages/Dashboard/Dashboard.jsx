import { useEffect, useMemo, useState } from 'react';
import { Droplets, TrendingUp, UserCheck, UserX, AlertTriangle, AlertCircle } from 'lucide-react';
import { memberService } from '../../services/memberService';
import { productService } from '../../services/productService';
import { shiftService } from '../../services/shiftService';
import { paymentService } from '../../services/paymentService';
import { formatDate } from '../../utils/formatters';

function getMemberStatus(endDate) {
  if (!endDate) return 'Expired';
  const today = new Date();
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  return endDate >= todayStr ? 'Active' : 'Expired';
}

export default function Dashboard() {
  const [members, setMembers] = useState([]);
  const [recentMembers, setRecentMembers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drinkRevenue, setDrinkRevenue] = useState(0);
  const [membershipRevenue, setMembershipRevenue] = useState(0);
  const [activeShift, setActiveShift] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const startOfMonthObj = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const startOfMonth = startOfMonthObj.toISOString();
        
        const [data, recent, totalMemberRev, allProducts] = await Promise.all([
          memberService.getAllMembers(),
          memberService.getRecentMembers(5),
          paymentService.getTotalMemberRevenue({ startDate: startOfMonth }),
          productService.getAllProducts()
        ]);
        setMembers(data);
        setRecentMembers(recent);
        setMembershipRevenue(totalMemberRev);
        setProducts(allProducts);

        // Lấy doanh thu nước ca hiện tại
        const { shift } = await shiftService.validateShiftForLogin();
        setActiveShift(shift);
        if (shift) {
          const rev = await productService.getDrinkRevenueForShift(shift.id);
          setDrinkRevenue(rev);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const stats = useMemo(() => {
    const activeCount = members.filter((m) => getMemberStatus(m.end_date) === 'Active').length;
    const expiredCount = members.filter((m) => getMemberStatus(m.end_date) === 'Expired').length;
    
    // Member revenue is now tracked via payment logs
    const memberRevenue = membershipRevenue;

    const pendingCkCount = members.filter(
      (m) => m.payment_method === 'CK' && !m.is_payment_verified
    ).length;

    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const expiringSoon = members.filter(m => 
      m.end_date && m.end_date >= todayStr && m.end_date <= nextWeekStr
    );

    const lowStock = products.filter(p => Number(p.stock_quantity || 0) < 10);

    return { activeCount, expiredCount, memberRevenue, pendingCkCount, expiringSoon, lowStock };
  }, [members, membershipRevenue, products]);

  return (
    <div className="modern-stack">
      {loading && <div className="modern-info">Đang tải dữ liệu...</div>}

      {/* Thông báo nhắc nhở */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {stats.pendingCkCount > 0 && (
          <div className="modern-info">
            ⚠️ Có <strong>{stats.pendingCkCount}</strong> hội viên thanh toán CK đang chờ duyệt.
          </div>
        )}

        {stats.expiringSoon.length > 0 && (
          <div className="modern-error" style={{ background: '#fffbeb', border: '1px solid #fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} />
            <div>
              Có <strong>{stats.expiringSoon.length}</strong> hội viên sắp hết hạn trong 7 ngày tới.
            </div>
          </div>
        )}

        {stats.lowStock.length > 0 && (
          <div className="modern-error" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} />
            <div>
              Có <strong>{stats.lowStock.length}</strong> loại nước sắp hết hàng (tồn kho &lt; 10).
            </div>
          </div>
        )}
      </div>

      {/* Stats grid — 4 thẻ */}
      <div className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
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
            <p className="stat-label-modern">Doanh thu hội viên (Tháng này)</p>
            <p className="stat-value-modern" style={{ fontSize: '20px' }}>
              {stats.memberRevenue.toLocaleString('vi-VN')}đ
            </p>
            <p className="cell-sub">(Đã xác nhận)</p>
          </div>
        </div>

        <div className="modern-card stat-card-modern">
          <div className="stat-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Droplets size={22} />
          </div>
          <div>
            <p className="stat-label-modern">
              Doanh thu nước{activeShift ? ` – ${activeShift.shift_name}` : ''}
            </p>
            <p className="stat-value-modern" style={{ fontSize: '20px', color: '#059669' }}>
              {drinkRevenue.toLocaleString('vi-VN')}đ
            </p>
            <p className="cell-sub">{activeShift ? 'Ca đang mở' : 'Chưa có ca nào đang mở'}</p>
          </div>
        </div>
      </div>

      {/* Hội viên đăng ký gần đây */}
      <div className="modern-card">
        <h3 className="modern-title">Hội viên đăng ký / gia hạn gần đây</h3>
        <div className="modern-list">
          {recentMembers.length === 0 && <p className="muted-text">Chưa có dữ liệu hội viên.</p>}
          {recentMembers.map((m) => (
            <div key={m.id} className="modern-list-item">
              <div className="member-avatar">{(m.full_name || 'U').charAt(0).toUpperCase()}</div>
              <div className="flex-1">
                <p className="member-name">{m.full_name}</p>
                <p className="member-meta">
                  Gói {m.package_type} tháng – {m.payment_method === 'TM' ? 'Tiền mặt' : 'Chuyển khoản'}
                  {m.payment_method === 'CK' && !m.is_payment_verified && (
                    <span style={{
                      marginLeft: '6px', background: '#fef08a', color: '#854d0e',
                      borderRadius: '999px', padding: '2px 7px', fontSize: '11px', fontWeight: '800'
                    }}>Chờ duyệt</span>
                  )}
                </p>
                <p className="member-meta" style={{ fontSize: '11px', color: '#64748b' }}>
                  Hết hạn: {formatDate(m.end_date)}
                </p>
              </div>
              <p className="member-fee">+{Number(m.fee || 0).toLocaleString('vi-VN')}đ</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
