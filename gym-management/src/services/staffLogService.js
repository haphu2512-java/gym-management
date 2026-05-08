import supabase from '../config/supabase';

const TABLE_NAME = 'staff_logs';

export const staffLogService = {
  async logAction({ staffId, action, targetItem = '', details = null, note = '', created_at = null }) {
    if (!staffId) return;
    const payload = {
      staff_id: staffId,
      action,
      target_item: targetItem,
      details,
      note,
      created_at: created_at || new Date().toISOString(),
    };

    const { error } = await supabase.from(TABLE_NAME).insert([payload]);
    if (error) console.error('Thêm Staff Log thất bại:', error.message);
  },

  async getLogs() {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },
};

