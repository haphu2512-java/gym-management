import supabase from '../config/supabase';
import { fetchAllRows } from '../utils/fetchAllRows';

export const statisticsService = {
  async getDetailedStats(filters = {}) {
    const buildSalesQuery = () => {
      let query = supabase
        .from('sales_logs')
        .select('quantity, total_price, sold_at, products(name), shifts(shift_name), staff_members:sold_by_member(full_name)');
      if (filters.startDate) query = query.gte('sold_at', filters.startDate);
      if (filters.endDate) query = query.lte('sold_at', filters.endDate);
      return query.order('id');
    };

    const buildPaymentQuery = () => {
      let query = supabase
        .from('payment_logs')
        .select('amount, payment_type, created_at, shifts(shift_name), staff_members:staff_member_id(full_name)')
        .eq('is_verified', true)
        .in('payment_type', ['new', 'renew', 'refund']);
      if (filters.startDate) query = query.gte('created_at', filters.startDate);
      if (filters.endDate) query = query.lte('created_at', filters.endDate);
      return query.order('id');
    };

    const [sales, payments] = await Promise.all([
      fetchAllRows(buildSalesQuery),
      fetchAllRows(buildPaymentQuery),
    ]);

    const waterSales = sales.map(s => {
      const dateObj = new Date(s.sold_at);
      return {
        date: dateObj.toLocaleDateString('vi-VN'),
        shift: s.shifts?.shift_name || 'Không có ca',
        staff: s.staff_members?.full_name || 'Không rõ',
        product: s.products?.name || 'Sản phẩm',
        quantity: s.quantity || 0,
        revenue: Number(s.total_price || 0)
      };
    }).filter(s => s.revenue > 0 || s.quantity > 0);

    const memberships = payments.map(p => {
      const dateObj = new Date(p.created_at);
      return {
        date: dateObj.toLocaleDateString('vi-VN'),
        shift: p.shifts?.shift_name || 'Không có ca',
        staff: p.staff_members?.full_name || 'Không rõ',
        type: p.payment_type,
        revenue: Number(p.amount || 0)
      };
    }).filter(p => p.revenue !== 0); // giữ cả khoản hoàn tiền (số âm)

    return { waterSales, memberships };
  },

  // Tổng doanh thu tính bằng SQL. Doanh thu dịch vụ gộp vào doanh thu hội viên.
  async getOverallStats(filters = {}) {
    const { data, error } = await supabase.rpc('get_revenue_summary', {
      p_start: filters.startDate || null,
      p_end: filters.endDate || null,
    });
    if (error) throw new Error(error.message);

    const waterRevenue = Number(data?.water || 0);
    const memberRevenue = Number(data?.member || 0) + Number(data?.service || 0);

    return {
      waterRevenue,
      memberRevenue,
      totalRevenue: waterRevenue + memberRevenue
    };
  }
};
