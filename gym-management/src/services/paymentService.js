import supabase from '../config/supabase';
import { fetchAllRows } from '../utils/fetchAllRows';

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

  async verifyPayment(paymentId, adminId, staffMemberId = null) {
    // Use atomic verification function
    const { data, error } = await supabase.rpc('verify_payment_atomic', {
      p_payment_id: paymentId,
      p_admin_id: adminId,
      p_staff_member_id: staffMemberId,
      p_verified_at: new Date().toISOString()
    });

    if (error) throw new Error('Xác thực thanh toán thất bại: ' + error.message);
    if (!data.success) throw new Error(data.error || 'Xác thực thanh toán thất bại');

    return data;
  },

  async verifyAllPayments(adminId, staffMemberId = null) {
    const verifiedAt = new Date().toISOString();

    // 1. Thử gọi RPC atomic verify_all_payments_atomic nếu có trong DB
    try {
      const { data, error } = await supabase.rpc('verify_all_payments_atomic', {
        p_admin_id: adminId,
        p_staff_member_id: staffMemberId,
        p_verified_at: verifiedAt
      });
      if (!error && data && data.success !== false) {
        return { count: data.count || 0, success: true };
      }
    } catch (rpcErr) {
      console.warn('RPC verify_all_payments_atomic chưa có sẵn, fallback sang batch:', rpcErr);
    }

    // 2. Fallback: Quét danh sách và duyệt từng payment
    const { data: pendingPayments, error: pError } = await supabase
      .from(TABLE_NAME)
      .select('id, member_id, amount')
      .eq('payment_method', 'CK')
      .or('is_verified.is.null,is_verified.eq.false');

    if (pError) throw pError;

    const { data: pendingLogs } = await supabase
      .from('member_logs')
      .select('id, member_id, details')
      .eq('payment_method', 'CK')
      .or('is_payment_verified.is.null,is_payment_verified.eq.false');

    const paymentIds = new Set();
    (pendingPayments || []).forEach(p => paymentIds.add(p.id));
    (pendingLogs || []).forEach(l => {
      if (l.details?.payment_id) paymentIds.add(l.details.payment_id);
    });

    let count = 0;
    for (const paymentId of paymentIds) {
      try {
        const { data, error } = await supabase.rpc('verify_payment_atomic', {
          p_payment_id: paymentId,
          p_admin_id: adminId,
          p_staff_member_id: staffMemberId,
          p_verified_at: verifiedAt
        });
        if (!error && (data?.success || data === true)) {
          count++;
        }
      } catch (err) {
        console.error('Lỗi khi duyệt payment:', paymentId, err);
      }
    }

    // Đồng bộ các member_logs còn lại nếu có
    const { data: remainingLogs } = await supabase
      .from('member_logs')
      .select('id, member_id')
      .eq('payment_method', 'CK')
      .or('is_payment_verified.is.null,is_payment_verified.eq.false');

    if (remainingLogs && remainingLogs.length > 0) {
      await supabase
        .from('member_logs')
        .update({ is_payment_verified: true })
        .in('id', remainingLogs.map(l => l.id));

      for (const rLog of remainingLogs) {
        await supabase.from('member_logs').insert([{
          member_id: rLog.member_id,
          staff_id: adminId,
          staff_member_id: staffMemberId,
          action: 'VERIFY_PAYMENT',
          is_payment_verified: true,
          note: 'Admin duyệt thanh toán hàng loạt',
          created_at: verifiedAt
        }]);
      }
    }

    const totalProcessed = Math.max(count, (pendingPayments || []).length, (pendingLogs || []).length);
    return { count: totalProcessed, success: true };
  },

  async getTotalMemberRevenue(filters = {}) {
    const data = await fetchAllRows(() => {
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
      return query.order('id');
    });
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
