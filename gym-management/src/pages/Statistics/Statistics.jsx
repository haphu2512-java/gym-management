import { useState, useMemo, useEffect } from 'react';
import { PieChart, TrendingUp, Users, Droplets, Calendar, Download, User } from 'lucide-react';
import { statisticsService } from '../../services/statisticsService';

export default function Statistics() {
  const [dateRange, setDateRange] = useState('week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [detailedStats, setDetailedStats] = useState({ waterSales: [], memberships: [] });
  const [overallStats, setOverallStats] = useState({ waterRevenue: 0, memberRevenue: 0, totalRevenue: 0 });
  const [packageStats, setPackageStats] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pivot States
  const [pivotSubject, setPivotSubject] = useState('water'); // 'water' or 'membership'
  const [pivotBy, setPivotBy] = useState('date'); // 'date' | 'shift' | 'staff'

  useEffect(() => {
    const fetchData = async () => {
      if (dateRange === 'custom' && (!customStartDate || !customEndDate)) return;

      setLoading(true);
      try {
        let startDate = null;
        let endDate = null;
        const now = new Date();
        const baseDate = new Date(now); // Create a copy to avoid mutation

        if (dateRange === 'today') {
          startDate = new Date(baseDate.setHours(0, 0, 0, 0)).toISOString();
        } else if (dateRange === 'week') {
          const first = baseDate.getDate() - baseDate.getDay() + (baseDate.getDay() === 0 ? -6 : 1); 
          startDate = new Date(baseDate.setDate(first));
          startDate.setHours(0, 0, 0, 0);
          startDate = startDate.toISOString();
        } else if (dateRange === 'month') {
          startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1).toISOString();
        } else if (dateRange === 'custom') {
          startDate = new Date(customStartDate);
          startDate.setHours(0, 0, 0, 0);
          startDate = startDate.toISOString();

          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
          endDate = endDate.toISOString();
        }

        const [detailed, overall, pkg] = await Promise.all([
          statisticsService.getDetailedStats({ startDate, endDate }),
          statisticsService.getOverallStats({ startDate, endDate }),
          statisticsService.getPackageStats()
        ]);

        setDetailedStats(detailed);
        setOverallStats(overall);
        setPackageStats(pkg);
      } catch (error) {
        console.error("Error fetching statistics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, customStartDate, customEndDate]);

  const totals = useMemo(() => {
    return {
      memberTotal: overallStats.memberRevenue,
      waterTotal: overallStats.waterRevenue,
      combined: overallStats.totalRevenue
    };
  }, [overallStats]);

  const totalMembers = useMemo(() => packageStats.reduce((s, p) => s + p.count, 0), [packageStats]);

  const pivotData = useMemo(() => {
    const data = [];
    const grouped = {};

    if (pivotSubject === 'water') {
      detailedStats.waterSales.forEach(item => {
        const key = item[pivotBy];
        if (!grouped[key]) grouped[key] = { key, quantity: 0, revenue: 0, products: {} };
        grouped[key].quantity += item.quantity;
        grouped[key].revenue += item.revenue;
        grouped[key].products[item.product] = (grouped[key].products[item.product] || 0) + item.quantity;
      });
      for (const k in grouped) data.push(grouped[k]);
    } else {
      detailedStats.memberships.forEach(item => {
        const key = item[pivotBy];
        if (!grouped[key]) grouped[key] = { key, revenue: 0, newCount: 0, renewCount: 0 };
        grouped[key].revenue += item.revenue;
        if (item.type === 'new') grouped[key].newCount += 1;
        if (item.type === 'renew') grouped[key].renewCount += 1;
      });
      for (const k in grouped) data.push(grouped[k]);
    }

    // Sort: if date, sort descending. Otherwise sort alphabetically
    return data.sort((a, b) => {
      if (pivotBy === 'date') {
        return new Date(b.key.split('/').reverse().join('-')) - new Date(a.key.split('/').reverse().join('-'));
      }
      return a.key.localeCompare(b.key);
    });
  }, [detailedStats, pivotSubject, pivotBy]);

  return (
    <div className="modern-stack">
      <div className="modern-toolbar">
        <div>
          <h3 className="modern-title">Thống Kê Chi Tiết</h3>
          <p className="muted-text">Phân tích doanh thu và tăng trưởng của phòng tập.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {dateRange === 'custom' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginRight: '10px' }}>
              <input
                type="date"
                className="ghost-btn"
                style={{ padding: '6px 10px', fontSize: '13px' }}
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <span style={{ fontSize: '12px', color: '#64748b' }}>đến</span>
              <input
                type="date"
                className="ghost-btn"
                style={{ padding: '6px 10px', fontSize: '13px' }}
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
          )}
          <select
            className="ghost-btn"
            style={{ padding: '8px 12px' }}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="today">Hôm nay</option>
            <option value="week">Tuần này</option>
            <option value="month">Tháng này</option>
            <option value="custom">Tùy chọn</option>
            <option value="all">Tất cả</option>
          </select>
          <button className="primary-btn">
            <Download size={16} /> Xuất báo cáo
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="modern-card stat-card-modern">
          <div className="stat-icon-wrap blue"><TrendingUp size={22} /></div>
          <div>
            <p className="stat-label-modern">Tổng doanh thu</p>
            <p className="stat-value-modern">{totals.combined.toLocaleString('vi-VN')}đ</p>
            <p className="cell-sub">Dữ liệu {dateRange === 'all' ? 'từ trước đến nay' : `trong ${dateRange}`}</p>
          </div>
        </div>
        <div className="modern-card stat-card-modern">
          <div className="stat-icon-wrap green"><Users size={22} /></div>
          <div>
            <p className="stat-label-modern">Doanh thu học phí</p>
            <p className="stat-value-modern">{totals.memberTotal.toLocaleString('vi-VN')}đ</p>
            <p className="cell-sub">{totals.combined > 0 ? Math.round((totals.memberTotal / totals.combined) * 100) : 0}% tổng doanh thu</p>
          </div>
        </div>
        <div className="modern-card stat-card-modern">
          <div className="stat-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Droplets size={22} />
          </div>
          <div>
            <p className="stat-label-modern">Doanh thu nước</p>
            <p className="stat-value-modern">{totals.waterTotal.toLocaleString('vi-VN')}đ</p>
            <p className="cell-sub">{totals.combined > 0 ? Math.round((totals.waterTotal / totals.combined) * 100) : 0}% tổng doanh thu</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Cơ cấu gói tập (Pie Chart style) */}
        <div className="modern-card">
          <h4 className="modern-title"><PieChart size={18} /> Cơ cấu gói tập đăng ký</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginTop: '20px' }}>
            <div style={{ 
              width: '150px', 
              height: '150px', 
              borderRadius: '50%', 
              background: totalMembers > 0 
                ? (() => {
                    let cumulative = 0;
                    const segments = packageStats.map(p => {
                      const start = cumulative;
                      const end = start + (p.count / totalMembers) * 100;
                      cumulative = end;
                      return `${p.color} ${start}% ${end}%`;
                    });
                    return `conic-gradient(${segments.join(', ')})`;
                  })()
                : '#f1f5f9', 
              position: 'relative' 
            }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80px', height: '80px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#1e293b', fontSize: '14px', textAlign: 'center' }}>
                {totalMembers} HV
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {packageStats.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', background: item.color, borderRadius: '3px' }}></div>
                    <span style={{ fontSize: '13px', color: '#475569' }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{item.count} HV</span>
                </div>
              ))}
              {packageStats.length === 0 && <p className="muted-text">Chưa có dữ liệu gói tập</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Pivot Statistics Section */}
      <div className="modern-card">
        <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: '20px' }}>
          <h4 className="modern-title"><Calendar size={18} /> Phân tích dữ liệu đa chiều (Pivot)</h4>
          <div className="flex-row" style={{ gap: '12px' }}>
            <select className="ghost-btn" value={pivotSubject} onChange={(e) => setPivotSubject(e.target.value)}>
              <option value="water">Đối tượng: Nước</option>
              <option value="membership">Đối tượng: Hội viên</option>
            </select>
            <select className="ghost-btn" value={pivotBy} onChange={(e) => setPivotBy(e.target.value)}>
              <option value="date">Nhóm theo: Ngày</option>
              <option value="shift">Nhóm theo: Ca làm</option>
              <option value="staff">Nhóm theo: Nhân viên</option>
            </select>
          </div>
        </div>

        <div className="modern-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>{pivotBy === 'date' ? 'Ngày' : pivotBy === 'shift' ? 'Ca làm' : 'Nhân viên'}</th>
                {pivotSubject === 'water' ? (
                  <>
                    <th>Tổng doanh thu</th>
                    <th>Tổng số lượng</th>
                    <th>Chi tiết sản phẩm</th>
                  </>
                ) : (
                  <>
                    <th>Tổng doanh thu</th>
                    <th>Đăng ký mới</th>
                    <th>Gia hạn</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {pivotData.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: '600', color: '#1e293b' }}>{row.key}</td>
                  <td style={{ color: '#059669', fontWeight: 'bold' }}>{row.revenue.toLocaleString('vi-VN')}đ</td>
                  
                  {pivotSubject === 'water' ? (
                    <>
                      <td style={{ fontWeight: '500' }}>{row.quantity}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {Object.entries(row.products).map(([prod, qty]) => (
                            <span key={prod} style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                              {prod}: <b>{qty}</b>
                            </span>
                          ))}
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{row.newCount > 0 ? <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{row.newCount} thẻ</span> : '-'}</td>
                      <td>{row.renewCount > 0 ? <span style={{ color: '#ea580c', fontWeight: 'bold' }}>{row.renewCount} lượt</span> : '-'}</td>
                    </>
                  )}
                </tr>
              ))}
              {pivotData.length === 0 && !loading && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '40px' }} className="muted-text">
                    Không có dữ liệu trong khoảng thời gian này.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '40px' }} className="muted-text">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
}
