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

  async getLogs(page = 1, pageSize = 50, filterDate = '', filterAction = '') {
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

    if (filterAction) {
      query = query.eq('action', filterAction);
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

  // Các giá trị action khác nhau có trong nhật ký, sắp theo tên.
  // Ưu tiên hàm get_staff_log_actions trên server (migration 20261103000600);
  // nếu chưa chạy migration thì lấy từ 1000 nhật ký gần nhất.
  async getActions() {
    const { data, error } = await supabase.rpc('get_staff_log_actions');
    let actions;
    if (!error && Array.isArray(data)) {
      actions = data.map((row) => (typeof row === 'string' ? row : row?.action));
    } else {
      const { data: rows, error: fallbackError } = await supabase
        .from(TABLE_NAME)
        .select('action')
        .order('created_at', { ascending: false })
        .range(0, 999);
      if (fallbackError) throw new Error(fallbackError.message);
      actions = (rows || []).map((row) => row.action);
    }
    return [...new Set(actions.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  },
};

