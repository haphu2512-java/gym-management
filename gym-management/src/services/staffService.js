import supabase from '../config/supabase';

export const staffService = {
    getStaffs: async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, role, created_at, note, staff_type')
            .eq('role', 'staff')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    updateStaffProfile: async (id, updates) => {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    getSalaryConfigs: async () => {
        const { data, error } = await supabase
            .from('salary_configs')
            .select('*')
            .order('shift_name', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    updateSalaryRate: async (id, rate) => {
        const { data, error } = await supabase
            .from('salary_configs')
            .update({ rate_per_shift: rate, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    getWeeklySchedules: async (weekStart) => {
        const { data, error } = await supabase
            .from('weekly_schedules')
            .select('*, profiles(full_name)')
            .eq('week_start', weekStart);
        if (error) throw error;
        return data || [];
    },

    upsertWeeklySchedule: async (schedule) => {
        const { data, error } = await supabase
            .from('weekly_schedules')
            .upsert(schedule, { onConflict: 'staff_id, week_start, shift_name, day_of_week' })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    deleteWeeklySchedule: async (weekStart) => {
        const { error } = await supabase
            .from('weekly_schedules')
            .delete()
            .eq('week_start', weekStart);
        if (error) throw error;
    }
};
