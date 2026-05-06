import supabase from '../config/supabase';

export const staffService = {
    getStaffs: async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, role, created_at, note')
            .eq('role', 'staff')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },
};
