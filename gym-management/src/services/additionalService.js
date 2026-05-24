import supabase from '../config/supabase';

const SERVICE_TABLE = 'services';

export const additionalService = {
  async getAllServices() {
    const { data, error } = await supabase
      .from(SERVICE_TABLE)
      .select('*')
      .is('deleted_at', null)
      .order('name');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async addService(payload) {
    const { data, error } = await supabase.from(SERVICE_TABLE).insert([payload]).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateService(id, payload) {
    const { data, error } = await supabase
      .from(SERVICE_TABLE)
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async sellService(service, quantity, shiftId, authId, staffId, paymentMethod = 'TM') {
    const qty = Number(quantity || 1);
    const { data, error } = await supabase.rpc('sell_service_transaction', {
      p_service_id: service.id,
      p_shift_id: shiftId,
      p_auth_id: authId,
      p_staff_id: staffId,
      p_quantity: qty,
      p_total_price: Number(service.price || 0) * qty,
      p_payment_method: paymentMethod,
      p_sold_at: new Date().toISOString()
    });

    if (error) throw new Error('Bán dịch vụ thất bại: ' + error.message);
    if (data?.success === false) throw new Error(data.error || 'Bán dịch vụ thất bại');

    return data;
  },

  async deleteService(id) {
    const { error } = await supabase
      .from(SERVICE_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getServiceRevenueForShift(shiftId, paymentMethod = null) {
    if (!shiftId) return 0;
    let query = supabase
      .from('service_sales')
      .select('total_price')
      .eq('shift_id', shiftId);
    
    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  },

  async getFilteredServiceLogs(filters = {}) {
    let query = supabase
      .from('service_sales')
      .select(`
        *,
        services (name),
        profiles:sold_by (full_name),
        staff_members:sold_by_member (full_name),
        shifts!inner (shift_name)
      `)
      .order('sold_at', { ascending: false });

    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      query = query.gte('sold_at', start.toISOString());
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('sold_at', end.toISOString());
    }
    if (filters.date && !filters.startDate && !filters.endDate) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.gte('sold_at', startOfDay.toISOString())
                   .lte('sold_at', endOfDay.toISOString());
    }

    if (filters.shiftName) {
      query = query.eq('shifts.shift_name', filters.shiftName);
    }

    if (filters.paymentMethod) {
      query = query.eq('payment_method', filters.paymentMethod);
    }
    
    const lim = filters.limit !== undefined ? filters.limit : (filters.startDate || filters.endDate ? null : 200);
    if (lim) {
      query = query.limit(lim);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },
};
