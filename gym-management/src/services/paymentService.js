import supabase from '../config/supabase';

const TABLE_NAME = 'payment_logs';

export const paymentService = {
  async getRecentPayments(limit = 20) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*, members(full_name), profiles(full_name)')
      .order('paid_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async createPaymentLog({ memberId, shiftId, amount, method, type, staffId, note = '' }) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert([{
        member_id: memberId,
        shift_id: shiftId,
        collected_by: staffId,
        amount: Number(amount),
        payment_method: method,
        payment_type: type,
        note,
        is_verified: method === 'TM' // Cash is auto-verified, CK needs manual verification
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async verifyPayment(id) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({ is_verified: true })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getTotalMemberRevenue() {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('amount')
      .eq('is_verified', true);
    if (error) throw error;
    return data.reduce((sum, p) => sum + Number(p.amount), 0);
  }
};
