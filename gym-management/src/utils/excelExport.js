import * as XLSX from 'xlsx';

function saveFile(workbook, filename) {
  XLSX.writeFile(workbook, filename);
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('vi-VN') + 'đ';
}

function formatDateVN(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('vi-VN');
}

// =============================================
// 1. Xuất danh sách Hội Viên
// =============================================
export function exportMembersToExcel(members) {
  const rows = members.map((m, idx) => ({
    'STT': idx + 1,
    'Mã HV': m.member_code || '',
    'Họ tên': m.full_name || '',
    'Loại thẻ': (m.membership_category || 'normal').toUpperCase(),
    'Gói (tháng)': m.package_type || '',
    'Ngày bắt đầu': formatDateVN(m.start_date),
    'Ngày hết hạn': formatDateVN(m.end_date),
    'Học phí': formatCurrency(m.fee),
    'Thanh toán': m.payment_method || '',
    'Đã xác nhận': m.is_payment_verified ? 'Đã duyệt' : 'Chờ duyệt',
    'Vân tay': m.fingerprint_status ? 'Đã đăng ký' : 'Chưa',
    'Trạng thái': m.suspended_at ? 'Bảo lưu' : (new Date(m.end_date) >= new Date() ? 'Đang tập' : 'Hết hạn'),
    'Ghi chú': m.note || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 5 }, { wch: 12 }, { wch: 25 }, { wch: 10 },
    { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách HV');

  const today = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
  saveFile(wb, `DanhSachHoiVien_${today}.xlsx`);
}

// =============================================
// 2. Xuất Báo Cáo Doanh Thu
// =============================================
export function exportRevenueToExcel({ overallStats, detailedStats, packageStats, dateRange }) {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Tổng quan ---
  const summaryRows = [
    { 'Chỉ tiêu': 'Tổng doanh thu', 'Giá trị': formatCurrency(overallStats.totalRevenue) },
    { 'Chỉ tiêu': 'Doanh thu học phí (+ dịch vụ)', 'Giá trị': formatCurrency(overallStats.memberRevenue) },
    { 'Chỉ tiêu': 'Doanh thu nước', 'Giá trị': formatCurrency(overallStats.waterRevenue) },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 35 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng quan');

  // --- Sheet 2: Chi tiết học phí ---
  if (detailedStats.memberships?.length > 0) {
    const memberRows = detailedStats.memberships.map((m, idx) => ({
      'STT': idx + 1,
      'Ngày': m.date || '',
      'Loại': m.type === 'new' ? 'Đăng ký mới' : 'Gia hạn',
      'Doanh thu': formatCurrency(m.revenue),
      'Ca làm': m.shift || '',
      'Nhân viên': m.staff || '',
    }));
    const wsMember = XLSX.utils.json_to_sheet(memberRows);
    wsMember['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsMember, 'Chi tiết học phí');
  }

  // --- Sheet 3: Chi tiết nước ---
  if (detailedStats.waterSales?.length > 0) {
    const waterRows = detailedStats.waterSales.map((w, idx) => ({
      'STT': idx + 1,
      'Ngày': w.date || '',
      'Sản phẩm': w.product || '',
      'Số lượng': w.quantity || 0,
      'Doanh thu': formatCurrency(w.revenue),
      'Ca làm': w.shift || '',
      'Nhân viên': w.staff || '',
    }));
    const wsWater = XLSX.utils.json_to_sheet(waterRows);
    wsWater['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsWater, 'Chi tiết nước');
  }

  // --- Sheet 4: Cơ cấu gói tập ---
  if (packageStats?.length > 0) {
    const pkgRows = packageStats.map((p, idx) => ({
      'STT': idx + 1,
      'Gói tập': p.label || '',
      'Số hội viên': p.count || 0,
    }));
    const wsPkg = XLSX.utils.json_to_sheet(pkgRows);
    wsPkg['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsPkg, 'Cơ cấu gói tập');
  }

  const today = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
  const rangeLabel = dateRange === 'today' ? 'HomNay' : dateRange === 'week' ? 'TuanNay' : dateRange === 'month' ? 'ThangNay' : 'TuyChon';
  saveFile(wb, `BaoCaoDoanhThu_${rangeLabel}_${today}.xlsx`);
}
