import { useState, useMemo } from 'react';
import { BarChart3, PieChart, TrendingUp, Users, Droplets, Calendar, Download } from 'lucide-react';

// --- MOCK DATA ---
const REVENUE_DATA = [
  { day: 'Thứ 2', member: 1200000, water: 350000 },
  { day: 'Thứ 3', member: 900000, water: 280000 },
  { day: 'Thứ 4', member: 1500000, water: 420000 },
  { day: 'Thứ 5', member: 1100000, water: 310000 },
  { day: 'Thứ 6', member: 2100000, water: 550000 },
  { day: 'Thứ 7', member: 2500000, water: 720000 },
  { day: 'Chủ nhật', member: 1800000, water: 480000 },
];

const PACKAGE_DATA = [
  { label: 'Gói 1 tháng', count: 45, color: '#3b82f6' },
  { label: 'Gói 3 tháng', count: 28, color: '#10b981' },
  { label: 'Gói 6 tháng', count: 15, color: '#f59e0b' },
  { label: 'Gói 12 tháng', count: 12, color: '#ef4444' },
];

const TOP_PRODUCTS = [
  { name: 'Nước suối Aquafina', quantity: 145, revenue: 1450000 },
  { name: 'Sting dâu', quantity: 82, revenue: 1230000 },
  { name: 'Nước khoáng Vĩnh Hảo', quantity: 64, revenue: 640000 },
  { name: 'Bò húc', quantity: 48, revenue: 960000 },
];

export default function Statistics() {
  const [dateRange, setDateRange] = useState('week');

  const totals = useMemo(() => {
    const memberTotal = REVENUE_DATA.reduce((acc, curr) => acc + curr.member, 0);
    const waterTotal = REVENUE_DATA.reduce((acc, curr) => acc + curr.water, 0);
    return { memberTotal, waterTotal, combined: memberTotal + waterTotal };
  }, []);

  const maxRevenue = Math.max(...REVENUE_DATA.map(d => d.member + d.water));

  return (
    <div className="modern-stack">
      <div className="modern-toolbar">
        <div>
          <h3 className="modern-title">Thống Kê Chi Tiết</h3>
          <p className="muted-text">Phân tích doanh thu và tăng trưởng của phòng tập.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
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
            <p className="cell-sub">+12% so với tuần trước</p>
          </div>
        </div>
        <div className="modern-card stat-card-modern">
          <div className="stat-icon-wrap green"><Users size={22} /></div>
          <div>
            <p className="stat-label-modern">Doanh thu học phí</p>
            <p className="stat-value-modern">{totals.memberTotal.toLocaleString('vi-VN')}đ</p>
            <p className="cell-sub">82% tổng doanh thu</p>
          </div>
        </div>
        <div className="modern-card stat-card-modern">
          <div className="stat-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Droplets size={22} />
          </div>
          <div>
            <p className="stat-label-modern">Doanh thu nước</p>
            <p className="stat-value-modern">{totals.waterTotal.toLocaleString('vi-VN')}đ</p>
            <p className="cell-sub">18% tổng doanh thu</p>
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
            {REVENUE_DATA.map((data, idx) => {
              const total = data.member + data.water;
              const height = (total / maxRevenue) * 100;
              const memberHeight = (data.member / total) * 100;
              
              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div 
                    className="chart-bar-group" 
                    style={{ 
                      width: '100%', 
                      height: `${height}%`, 
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
          </div>
        </div>

        {/* Cơ cấu gói tập (Pie Chart style) */}
        <div className="modern-card">
          <h4 className="modern-title"><PieChart size={18} /> Cơ cấu gói tập đăng ký</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginTop: '20px' }}>
            <div style={{ width: '150px', height: '150px', borderRadius: '50%', background: 'conic-gradient(#3b82f6 0% 45%, #10b981 45% 73%, #f59e0b 73% 88%, #ef4444 88% 100%)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80px', height: '80px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#1e293b' }}>
                100 HV
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {PACKAGE_DATA.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', background: item.color, borderRadius: '3px' }}></div>
                    <span style={{ fontSize: '13px', color: '#475569' }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{item.count} HV</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="modern-card">
        <h4 className="modern-title"><Droplets size={18} /> Top sản phẩm bán chạy nhất</h4>
        <div className="modern-table-wrap" style={{ marginTop: '10px' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Số lượng đã bán</th>
                <th>Doanh thu</th>
                <th style={{ width: '200px' }}>Tỷ trọng</th>
              </tr>
            </thead>
            <tbody>
              {TOP_PRODUCTS.map((p, idx) => {
                const maxQty = TOP_PRODUCTS[0].quantity;
                const width = (p.quantity / maxQty) * 100;
                return (
                  <tr key={idx}>
                    <td><p className="cell-main">{p.name}</p></td>
                    <td><p className="cell-main">{p.quantity} chai</p></td>
                    <td><p className="cell-main">{p.revenue.toLocaleString('vi-VN')}đ</p></td>
                    <td>
                      <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${width}%`, height: '100%', background: '#3b82f6' }}></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
