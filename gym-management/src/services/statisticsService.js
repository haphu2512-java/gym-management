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
        .in('payment_type', ['new', 'renew']);
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
    }).filter(p => p.revenue > 0);

    return { waterSales, memberships };
  },

  async getOverallStats(filters = {}) {
    // This could be expanded to fetch all stats for the page
    // For now, let's focus on what's needed for the dashboard summary
    
    const withRange = (query, dateColumn) => {
      if (filters.startDate) query = query.gte(dateColumn, filters.startDate);
      if (filters.endDate) query = query.lte(dateColumn, filters.endDate);
      return query.order('id');
    };

    const [salesRows, paymentRows, serviceRows] = await Promise.all([
      // Revenue from sales_logs
      fetchAllRows(() => withRange(supabase.from('sales_logs').select('total_price, sold_at'), 'sold_at')),
      // Revenue from payment_logs
      fetchAllRows(() => withRange(supabase.from('payment_logs').select('amount, created_at').eq('is_verified', true), 'created_at')),
      // Revenue from service_sales
      fetchAllRows(() => withRange(supabase.from('service_sales').select('total_price, sold_at'), 'sold_at')),
    ]);

    const waterRevenue = salesRows.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
    const memberRevenueBase = paymentRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const serviceRevenue = serviceRows.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
    
    // Gộp doanh thu dịch vụ vào doanh thu hội viên
    const memberRevenue = memberRevenueBase + serviceRevenue;

    return {
      waterRevenue,
      memberRevenue,
      totalRevenue: waterRevenue + memberRevenue
    };
  }
};
