import { useEffect, useMemo, useState } from 'react';
import { Droplets, TrendingUp, UserCheck, UserX, AlertTriangle, AlertCircle } from 'lucide-react';
import { memberService } from '../../services/memberService';
import { productService } from '../../services/productService';
import { shiftService } from '../../services/shiftService';
import { paymentService } from '../../services/paymentService';
import { additionalService } from '../../services/additionalService';
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
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const startOfMonthObj = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const startOfMonth = startOfMonthObj.toISOString();
        
        const [data, totalMemberRev, allProducts, totalDrinkRev] = await Promise.all([
          memberService.getAllMembers(),
          paymentService.getTotalMemberRevenue({ startDate: startOfMonth }),
          productService.getAllProducts(),
          productService.getTotalDrinkRevenue({ startDate: startOfMonth })
        ]);
        setMembers(data);
        setMembershipRevenue(totalMemberRev);
        setProducts(allProducts);
        setDrinkRevenue(totalDrinkRev);

        const { shift } = await shiftService.validateShiftForLogin();
        setActiveShift(shift);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const loadRecent = async () => {
      setLoadingRecent(true);
      try {
        const [membersRes, servicesRes] = await Promise.all([
          memberService.getRecentMembers(20, filterDate ? { date: filterDate } : {}),
          additionalService.getFilteredServiceLogs(filterDate ? { date: filterDate } : { limit: 20 })
        ]);

        const mappedServices = (servicesRes || []).map(s => ({
          id: `svc-${s.id}`,
          last_active_at: s.sold_at,
          full_name: s.services?.name || 'Dịch vụ lẻ',
          package_type: '',
          end_date: '',
          fee: s.total_price,
          member_code: '',
          note: `Số lượng: ${s.quantity}`,
          payment_method: s.payment_method,
          is_payment_verified: true,
        }));

        const combined = [...(membersRes || []), ...mappedServices].sort((a, b) => {
          const dateA = new Date(a.last_active_at || a.created_at || 0);
          const dateB = new Date(b.last_active_at || b.created_at || 0);
          return dateB - dateA;
        });

        // If no filter, limit to 20 total to match UI space
        setRecentMembers(filterDate ? combined : combined.slice(0, 20));
      } catch (err) {
        console.error("Error loading recent data", err);
      } finally {
        setLoadingRecent(false);
      }
    };
    loadRecent();
  }, [filterDate]);

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
              Doanh thu nước (Tháng này)
            </p>
            <p className="stat-value-modern" style={{ fontSize: '20px', color: '#059669' }}>
              {drinkRevenue.toLocaleString('vi-VN')}đ
            </p>
            <p className="cell-sub">(Đã xác nhận)</p>
          </div>
        </div>
      </div>

      {/* Hội viên đăng ký gần đây */}
      <div className="modern-card">
        <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="modern-title" style={{ margin: 0 }}>Hội viên & Khách lẻ đăng ký / gia hạn</h3>
          <input 
            type="date" 
            className="modern-input" 
            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            title="Lọc theo ngày đăng ký/gia hạn"
          />
        </div>
        <div className="modern-table-wrap" style={{ marginTop: '16px' }}>
          {loadingRecent ? (
            <p className="muted-text" style={{ padding: '20px' }}>Đang tải dữ liệu...</p>
          ) : recentMembers.length === 0 ? (
            <p className="muted-text" style={{ padding: '20px' }}>Chưa có dữ liệu hội viên.</p>
          ) : (
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Tên</th>
                  <th>Gói</th>
                  <th>Hết hạn</th>
                  <th>Số tiền</th>
                  <th>Mã HV</th>
                  <th>Ghi chú</th>
                  <th>Thanh toán</th>
                </tr>
              </thead>
              <tbody>
                {recentMembers.map((m) => (
                  <tr key={m.id}>
                    <td>{formatDate(m.last_active_at || m.created_at)}</td>
                    <td style={{ fontWeight: '500' }}>{m.full_name}</td>
                    <td>{m.package_type ? `${m.package_type} tháng` : ''}</td>
                    <td>{formatDate(m.end_date)}</td>
                    <td style={{ fontWeight: '600', color: '#16a34a' }}>
                      {Number(m.fee || 0).toLocaleString('vi-VN')}đ
                    </td>
                    <td>{m.member_code}</td>
                    <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.note}>
                      {m.note}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{m.payment_method}</span>
                        {m.payment_method === 'CK' && !m.is_payment_verified && (
                          <span style={{
                            background: '#fef08a', color: '#854d0e',
                            borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold'
                          }}>Chờ duyệt</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
