import supabase from '../config/supabase';

export const staffService = {
  // ============================================================
  // STAFF MEMBERS (bảng mới, độc lập khỏi auth.users)
  // ============================================================
  getStaffMembers: async () => {
    const { data, error } = await supabase
      .from('staff_members')
      .select('id, full_name, staff_type, note, created_at')
      .is('deleted_at', null)
      .order('full_name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  addStaffMember: async ({ full_name, staff_type = 'CT', note = '' }) => {
    const { data, error } = await supabase
      .from('staff_members')
      .insert([{ full_name, staff_type, note }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateStaffMember: async (id, updates) => {
    const { data, error } = await supabase
      .from('staff_members')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteStaffMember: async (id) => {
    const { error } = await supabase
      .from('staff_members')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  // ============================================================
  // CÁC HÀM CŨ — Giữ lại để tương thích (dùng bảng profiles cho 2 tài khoản Auth)
  // ============================================================
  getStaffs: async () => {
    // Giờ lấy từ staff_members thay vì profiles
    return staffService.getStaffMembers();
  },

  updateStaffProfile: async (id, updates) => {
    return staffService.updateStaffMember(id, updates);
  },

  // Salary configs (giữ nguyên)
  getSalaryConfigs: async () => {
    const { data, error } = await supabase
      .from('salary_configs')
      .select('*')
      .order('shift_name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  upsertSalaryRate: async (shiftName, staffType, rate) => {
    const { data, error } = await supabase
      .from('salary_configs')
      .upsert(
        { shift_name: shiftName, staff_type: staffType, rate_per_shift: rate },
        { onConflict: 'shift_name, staff_type' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Weekly schedules — dùng staff_member_id mới
  getWeeklySchedules: async (weekStart) => {
    const { data, error } = await supabase
      .from('weekly_schedules')
      .select('*, staff_members(full_name)')
      .eq('week_start', weekStart);
    if (error) throw error;
    return data || [];
  },

  upsertWeeklySchedule: async (schedule) => {
    const payload = {
      staff_member_id: schedule.staff_id, // staff_id từ UI là staff_member_id trong DB
      week_start: schedule.week_start,
      shift_name: schedule.shift_name,
      day_of_week: schedule.day_of_week,
    };
    const { data, error } = await supabase
      .from('weekly_schedules')
      .upsert(payload, { onConflict: 'week_start, day_of_week, shift_name' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteWeeklyScheduleEntry: async ({ weekStart, shiftName, dayOfWeek }) => {
    const { error } = await supabase
      .from('weekly_schedules')
      .delete()
      .eq('week_start', weekStart)
      .eq('shift_name', shiftName)
      .eq('day_of_week', dayOfWeek);
    if (error) throw error;
  },

  deleteWeeklySchedule: async (weekStart) => {
    const { error } = await supabase
      .from('weekly_schedules')
      .delete()
      .eq('week_start', weekStart);
    if (error) throw error;
  },

  getSalaryAdjustments: async (staffId, date) => {
    const { data, error } = await supabase
      .from('salary_adjustments')
      .select('*')
      .eq('staff_member_id', staffId)
      .eq('adjustment_date', date)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  getAllSalaryAdjustments: async (date) => {
    const { data, error } = await supabase
      .from('salary_adjustments')
      .select('*')
      .eq('adjustment_date', date);
    if (error) throw error;
    return data || [];
  },

  upsertSalaryAdjustment: async (adjustment) => {
    const payload = {
      staff_member_id: adjustment.staff_id, // staff_id từ UI map sang staff_member_id trong DB
      adjustment_date: adjustment.adjustment_date,
      commission: adjustment.commission,
      shortage: adjustment.shortage,
      penalty: adjustment.penalty,
      reason: adjustment.reason,
    };
    const { data, error } = await supabase
      .from('salary_adjustments')
      .upsert(payload, { onConflict: 'staff_member_id, adjustment_date' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
