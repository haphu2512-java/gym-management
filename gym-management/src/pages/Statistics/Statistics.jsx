import { useState, useMemo, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, Users, Droplets, Calendar, Download, User } from 'lucide-react';
import { statisticsService } from '../../services/statisticsService';

export default function Statistics() {
  const [dateRange, setDateRange] = useState('week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [waterStatsByStaff, setWaterStatsByStaff] = useState({});
  const [overallStats, setOverallStats] = useState({ waterRevenue: 0, memberRevenue: 0, totalRevenue: 0 });
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [packageStats, setPackageStats] = useState([]);
  const [loading, setLoading] = useState(true);

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

        const [waterStats, overall, daily, pkg] = await Promise.all([
          statisticsService.getWaterStatsByShiftAndStaff({ startDate, endDate }),
          statisticsService.getOverallStats({ startDate, endDate }),
          statisticsService.getDailyRevenue({ startDate, endDate }),
          statisticsService.getPackageStats()
        ]);

        setWaterStatsByStaff(waterStats);
        setOverallStats(overall);
        setDailyRevenue(daily);
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

  const maxRevenue = useMemo(() => {
    const vals = dailyRevenue.map(d => d.member + d.water);
    return vals.length > 0 ? Math.max(...vals, 100000) : 100000;
  }, [dailyRevenue]);

  const totalMembers = useMemo(() => packageStats.reduce((s, p) => s + p.count, 0), [packageStats]);

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
        {/* Doanh thu theo ngày (Bar Chart) */}
        <div className="modern-card">
          <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: '20px' }}>
            <h4 className="modern-title" style={{ margin: 0 }}><BarChart3 size={18} /> Biểu đồ doanh thu tuần</h4>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', background: '#3b82f6', borderRadius: '2px' }}></div> Học phí
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', background: '#93c5fd', borderRadius: '2px' }}></div> Nước
              </span>
            </div>
          </div>
          <div style={{ height: '240px', display: 'flex', alignItems: 'flex-end', gap: '12px', paddingBottom: '30px', position: 'relative' }}>
            {dailyRevenue.map((data, idx) => {
              const total = data.member + data.water;
              const height = (total / maxRevenue) * 100;
              const memberHeight = total > 0 ? (data.member / total) * 100 : 0;
              
              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div 
                    className="chart-bar-group" 
                    style={{ 
                      width: '100%', 
                      height: `${Math.max(height, 2)}%`, 
                      background: '#93c5fd', 
                      borderRadius: '4px 4px 0 0', 
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column-reverse',
                      overflow: 'hidden'
                    }}
                    title={`${data.day}: ${(data.member + data.water).toLocaleString()}đ`}
                  >
                    <div style={{ height: `${memberHeight}%`, background: '#3b82f6' }}></div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{data.day}</span>
                </div>
              );
            })}
            {dailyRevenue.length === 0 && <div className="muted-text" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>Chưa có dữ liệu doanh thu</div>}
          </div>
        </div>

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

      {/* Water Stats by Shift & Staff */}
      <div className="modern-card">
        <h4 className="modern-title"><User size={18} /> Thống kê nước theo ca & nhân viên</h4>
        <div className="modern-table-wrap" style={{ marginTop: '10px' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Chi tiết bán hàng (Ca | Số lượng | Tên nước)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(waterStatsByStaff).map(([staffName, shifts], idx) => (
                <tr key={idx}>
                  <td style={{ verticalAlign: 'top', width: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                        <User size={16} />
                      </div>
                      <p className="cell-main">{staffName}</p>
                    </div>
                  </td>
                  <td>
                    {Object.entries(shifts).map(([shiftName, products], sIdx) => (
                      <div key={sIdx} style={{ marginBottom: '12px' }}>
                        {Object.entries(products).map(([prodName, qty], pIdx) => (
                          <div key={pIdx} style={{
                            display: 'inline-block',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            marginRight: '8px',
                            marginBottom: '6px',
                            fontSize: '13px',
                            color: '#334155'
                          }}>
                            <span style={{ fontWeight: '600', color: '#3b82f6' }}>{shiftName}</span>
                            <span style={{ margin: '0 6px', color: '#cbd5e1' }}>|</span>
                            <span style={{ fontWeight: '600' }}>{qty}</span>
                            <span style={{ margin: '0 6px', color: '#cbd5e1' }}>|</span>
                            <span>{prodName}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    {Object.keys(shifts).length === 0 && <p className="muted-text">Không có dữ liệu</p>}
                  </td>
                </tr>
              ))}
              {Object.keys(waterStatsByStaff).length === 0 && !loading && (
                <tr>
                  <td colSpan="2" style={{ textAlign: 'center', padding: '40px' }} className="muted-text">
                    Không có dữ liệu bán hàng trong khoảng thời gian này.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan="2" style={{ textAlign: 'center', padding: '40px' }} className="muted-text">
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
