import supabase from '../config/supabase';

const TABLE_NAME = 'shift_expenses';

export const expenseService = {
  async getByShift(shiftId) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createExpense({ shiftId, amount, reason = '', staffId = null }) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert([
        {
          shift_id: shiftId,
          amount: Number(amount || 0),
          reason,
          created_by: staffId,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async getTotalByShift(shiftId) {
    const rows = await this.getByShift(shiftId);
    return rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  },

  async updateExpense(id, { amount, reason }) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({
        amount: Number(amount || 0),
        reason,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteExpense(id) {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },
};

