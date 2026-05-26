import supabase from '../config/supabase';

export const statisticsService = {
  async getDetailedStats(filters = {}) {
    let salesQuery = supabase
      .from('sales_logs')
      .select('quantity, total_price, sold_at, products(name), shifts(shift_name), staff_members:sold_by_member(full_name)');
      
    let paymentQuery = supabase
      .from('payment_logs')
      .select('amount, payment_type, created_at, shifts(shift_name), staff_members:staff_member_id(full_name)')
      .eq('is_verified', true)
      .in('payment_type', ['new', 'renew']);

    if (filters.startDate) {
      salesQuery = salesQuery.gte('sold_at', filters.startDate);
      paymentQuery = paymentQuery.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      salesQuery = salesQuery.lte('sold_at', filters.endDate);
      paymentQuery = paymentQuery.lte('created_at', filters.endDate);
    }

    const [salesRes, paymentRes] = await Promise.all([salesQuery, paymentQuery]);

    const sales = salesRes.data || [];
    const payments = paymentRes.data || [];

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
    
    // Revenue from sales_logs
    let salesQuery = supabase.from('sales_logs').select('total_price, sold_at');
    // Revenue from payment_logs
    let paymentQuery = supabase.from('payment_logs').select('amount, created_at').eq('is_verified', true);
    // Revenue from service_sales
    let serviceQuery = supabase.from('service_sales').select('total_price, sold_at');

    if (filters.startDate) {
      salesQuery = salesQuery.gte('sold_at', filters.startDate);
      paymentQuery = paymentQuery.gte('created_at', filters.startDate);
      serviceQuery = serviceQuery.gte('sold_at', filters.startDate);
    }
    if (filters.endDate) {
      salesQuery = salesQuery.lte('sold_at', filters.endDate);
      paymentQuery = paymentQuery.lte('created_at', filters.endDate);
      serviceQuery = serviceQuery.lte('sold_at', filters.endDate);
    }

    const [salesRes, paymentRes, serviceRes] = await Promise.all([salesQuery, paymentQuery, serviceQuery]);

    const waterRevenue = (salesRes.data || []).reduce((sum, item) => sum + Number(item.total_price || 0), 0);
    const memberRevenueBase = (paymentRes.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const serviceRevenue = (serviceRes.data || []).reduce((sum, item) => sum + Number(item.total_price || 0), 0);
    
    // Gộp doanh thu dịch vụ vào doanh thu hội viên
    const memberRevenue = memberRevenueBase + serviceRevenue;

    return {
      waterRevenue,
      memberRevenue,
      totalRevenue: waterRevenue + memberRevenue
    };
  }
};
