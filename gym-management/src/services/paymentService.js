import supabase from '../config/supabase';

const TABLE_NAME = 'payment_logs';

export const paymentService = {
  // Duyệt một khoản chuyển khoản. Server kiểm tra quyền admin bằng tài khoản đang đăng nhập.
  async verifyPayment(paymentId, staffMemberId = null) {
    const { data, error } = await supabase.rpc('verify_payment_atomic', {
      p_payment_id: paymentId,
      p_staff_member_id: staffMemberId,
    });

    if (error) throw new Error('Xác thực thanh toán thất bại: ' + error.message);
    if (data?.success === false) throw new Error(data.error || 'Xác thực thanh toán thất bại');

    return data;
  },

  async verifyAllPayments(staffMemberId = null) {
    const { data, error } = await supabase.rpc('verify_all_payments_atomic', {
      p_staff_member_id: staffMemberId,
    });

    if (error) throw new Error('Duyệt chuyển khoản thất bại: ' + error.message);
    if (data?.success === false) throw new Error(data.error || 'Duyệt chuyển khoản thất bại');

    return { count: data?.count || 0, success: true };
  },

  // Tổng doanh thu hội viên (đã duyệt, đã trừ hoàn tiền), tính bằng SQL
  async getTotalMemberRevenue(filters = {}) {
    const { data, error } = await supabase.rpc('get_revenue_summary', {
      p_start: filters.startDate || null,
      p_end: filters.endDate || null,
    });
    if (error) throw new Error(error.message);
    return Number(data?.member || 0);
  },

  // Các khoản thu (đăng ký/gia hạn) của một hội viên trong một ca
  async getMemberPaymentsInShift(memberId, shiftId) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id, amount, payment_method, payment_type, is_verified, created_at')
      .eq('member_id', memberId)
      .eq('shift_id', shiftId)
      .in('payment_type', ['new', 'renew'])
      .order('created_at');
    if (error) throw error;
    return data || [];
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
