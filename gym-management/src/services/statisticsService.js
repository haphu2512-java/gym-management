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
  },

  async getDailyRevenue(filters = {}) {
    let salesQuery = supabase.from('sales_logs').select('total_price, sold_at');
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
    const sales = salesRes.data || [];
    const payments = paymentRes.data || [];

    const dayLabels = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];
    const daily = {};

    sales.forEach(s => {
      const date = s.sold_at ? new Date(s.sold_at) : null;
      if (!date || isNaN(date.getTime())) return;
      
      const dayIndex = date.getDay();
      const day = dayLabels[dayIndex];
      if (!daily[day]) daily[day] = { day, member: 0, water: 0 };
      daily[day].water += Number(s.total_price || 0);
    });

    payments.forEach(p => {
      const date = p.created_at ? new Date(p.created_at) : null;
      if (!date || isNaN(date.getTime())) return;

      const dayIndex = date.getDay();
      const day = dayLabels[dayIndex];
      if (!daily[day]) daily[day] = { day, member: 0, water: 0 };
      daily[day].member += Number(p.amount || 0);
    });

    const order = ['Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7', 'CN'];
    return order.map(d => daily[d] || { day: d, member: 0, water: 0 });
  },

  async getPackageStats() {
    const { data } = await supabase
      .from('member_current_status')
      .select('package_type')
      .not('package_type', 'is', null);
    
    const counts = {};
    (data || []).forEach(m => {
      const label = `Gói ${m.package_type} tháng`;
      counts[label] = (counts[label] || 0) + 1;
    });

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    return Object.entries(counts).map(([label, count], idx) => ({
      label,
      count,
      color: colors[idx % colors.length]
    })).sort((a, b) => b.count - a.count);
  }
};
