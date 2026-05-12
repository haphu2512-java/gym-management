import supabase from '../config/supabase';

export const statisticsService = {
  async getWaterStatsByShiftAndStaff(filters = {}) {
    let query = supabase
      .from('sales_logs')
      .select(`
        quantity,
        total_price,
        sold_at,
        products (name),
        profiles:sold_by (full_name),
        staff_members:sold_by_member (full_name),
        shifts (shift_name)
      `);

    if (filters.startDate) {
      query = query.gte('sold_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('sold_at', filters.endDate);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Group by Staff -> Shift -> Product
    const grouped = {};

    (data || []).forEach(log => {
      const staffName = log.staff_members?.full_name || log.profiles?.full_name || 'Hệ thống';
      const shiftName = log.shifts?.shift_name || 'N/A';
      const productName = log.products?.name || 'Sản phẩm lạ';

      if (!grouped[staffName]) {
        grouped[staffName] = {};
      }
      if (!grouped[staffName][shiftName]) {
        grouped[staffName][shiftName] = {};
      }
      if (!grouped[staffName][shiftName][productName]) {
        grouped[staffName][shiftName][productName] = 0;
      }
      grouped[staffName][shiftName][productName] += log.quantity;
    });

    return grouped;
  },

  async getOverallStats(filters = {}) {
    // This could be expanded to fetch all stats for the page
    // For now, let's focus on what's needed for the dashboard summary
    
    // Revenue from sales_logs
    let salesQuery = supabase.from('sales_logs').select('total_price, sold_at');
    // Revenue from payment_logs
    let paymentQuery = supabase.from('payment_logs').select('amount, created_at').eq('is_verified', true);

    if (filters.startDate) {
      salesQuery = salesQuery.gte('sold_at', filters.startDate);
      paymentQuery = paymentQuery.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      salesQuery = salesQuery.lte('sold_at', filters.endDate);
      paymentQuery = paymentQuery.lte('created_at', filters.endDate);
    }

    const [salesRes, paymentRes] = await Promise.all([salesQuery, paymentQuery]);

    const waterRevenue = (salesRes.data || []).reduce((sum, item) => sum + Number(item.total_price || 0), 0);
    const memberRevenue = (paymentRes.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      waterRevenue,
      memberRevenue,
      totalRevenue: waterRevenue + memberRevenue
    };
  }
};
