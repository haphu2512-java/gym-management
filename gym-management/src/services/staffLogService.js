import supabase from '../config/supabase';

const TABLE_NAME = 'staff_logs';

export const staffLogService = {
  async logAction({ staffId, staffMemberId, action, targetItem = '', details = null, note = '', created_at = null }) {
    if (!staffId && !staffMemberId) return;
    const payload = {
      staff_id: staffId || null,
      staff_member_id: staffMemberId || null,
      action,
      target_item: targetItem,
      details,
      note,
      created_at: created_at || new Date().toISOString(),
    };

    const { error } = await supabase.from(TABLE_NAME).insert([payload]);
    if (error) console.error('Thêm Staff Log thất bại:', error.message);
  },

  async getLogs(page = 1, pageSize = 50, filterDate = '') {
    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;

    let query = supabase
      .from(TABLE_NAME)
      .select('*, profiles(full_name), staff_members(full_name)', { count: 'exact' });

    if (filterDate && /^\d{4}-\d{2}-\d{2}$/.test(filterDate)) {
      const start = new Date(`${filterDate}T00:00:00`).toISOString();
      const end = new Date(`${filterDate}T23:59:59.999`).toISOString();
      query = query.gte('created_at', start).lte('created_at', end);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);
    return {
      data: data || [],
      totalCount: count || 0,
    };
  },
};

