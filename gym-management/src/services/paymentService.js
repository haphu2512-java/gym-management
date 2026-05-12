import supabase from '../config/supabase';

const TABLE_NAME = 'payment_logs';

export const paymentService = {
  async getRecentPayments(limit = 20) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(`
        *,
        members!inner(full_name),
        profiles!payment_logs_staff_id_fkey(full_name),
        staff_members(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async createPaymentLog({ memberId, shiftId, amount, method, type, staffId, staffMemberId, note = '' }) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert([{
        member_id: memberId,
        shift_id: shiftId,
        staff_id: staffId,
        staff_member_id: staffMemberId,
        amount: Number(amount),
        payment_method: method,
        payment_type: type,
        note,
        is_verified: method === 'TM',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async verifyPayment(paymentId, adminId) {
    // Use atomic verification function
    const { data, error } = await supabase.rpc('verify_payment_atomic', {
      p_payment_id: paymentId,
      p_admin_id: adminId,
      p_verified_at: new Date().toISOString()
    });

    if (error) throw new Error('Xác thực thanh toán thất bại: ' + error.message);
    if (!data.success) throw new Error(data.error || 'Xác thực thanh toán thất bại');

    return data;
  },

  async getTotalMemberRevenue(filters = {}) {
    let query = supabase
      .from(TABLE_NAME)
      .select('amount')
      .eq('is_verified', true);

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data.reduce((sum, p) => sum + Number(p.amount), 0);
  },

  async getPaymentsByShift(shiftId, paymentMethod = null, isVerified = null) {
    let query = supabase
      .from(TABLE_NAME)
      .select('amount')
      .eq('shift_id', shiftId);

    if (paymentMethod) query = query.eq('payment_method', paymentMethod);
    if (isVerified !== null) query = query.eq('is_verified', isVerified);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
};
